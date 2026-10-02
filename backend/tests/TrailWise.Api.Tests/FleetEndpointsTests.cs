using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Api.Contracts.Fleet;
using TrailWise.Api.Contracts.Packages;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class FleetEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public FleetEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetAllVehicles_Anonymous_ReturnsOkWithFilterSupport()
    {
        var adminClient = await AdminClientAsync();

        var vanResponse = await adminClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Van,
            RegistrationNumber = NewRegistrationNumber(),
            Capacity = 8,
            HasAC = true,
            SeatConfiguration = "2-2-2-2",
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        });
        vanResponse.EnsureSuccessStatusCode();

        var coachResponse = await adminClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Coach,
            RegistrationNumber = NewRegistrationNumber(),
            Capacity = 30,
            HasAC = false,
            SeatConfiguration = "2-2 across 8 rows",
            MaintenanceStatus = VehicleMaintenanceStatus.UnderMaintenance
        });
        coachResponse.EnsureSuccessStatusCode();

        var client = _factory.CreateClient();

        // 1. Unfiltered
        var allRes = await client.GetAsync("/api/vehicles");
        allRes.EnsureSuccessStatusCode();
        var allVehicles = await allRes.Content.ReadFromJsonAsync<List<VehicleDto>>(JsonOptions);
        Assert.NotNull(allVehicles);
        Assert.True(allVehicles.Count >= 2);

        // 2. Filter by hasAC=true
        var acRes = await client.GetAsync("/api/vehicles?hasAC=true");
        var acVehicles = await acRes.Content.ReadFromJsonAsync<List<VehicleDto>>(JsonOptions);
        Assert.All(acVehicles!, v => Assert.True(v.HasAC));

        // 3. Filter by minCapacity=20
        var capRes = await client.GetAsync("/api/vehicles?minCapacity=20");
        var capVehicles = await capRes.Content.ReadFromJsonAsync<List<VehicleDto>>(JsonOptions);
        Assert.All(capVehicles!, v => Assert.True(v.Capacity >= 20));

        // 4. Filter by type=Coach
        var coachFilterRes = await client.GetAsync("/api/vehicles?type=Coach");
        var coachVehicles = await coachFilterRes.Content.ReadFromJsonAsync<List<VehicleDto>>(JsonOptions);
        Assert.All(coachVehicles!, v => Assert.Equal(VehicleType.Coach, v.Type));

        // 5. Filter by status=UnderMaintenance
        var maintRes = await client.GetAsync("/api/vehicles?status=UnderMaintenance");
        var maintVehicles = await maintRes.Content.ReadFromJsonAsync<List<VehicleDto>>(JsonOptions);
        Assert.All(maintVehicles!, v => Assert.Equal(VehicleMaintenanceStatus.UnderMaintenance, v.MaintenanceStatus));
    }

    [Fact]
    public async Task CreateVehicle_UnauthorizedOrForbidden_WhenNotFleetCoordinatorOrAdmin()
    {
        var anonymousClient = _factory.CreateClient();
        var anonRes = await anonymousClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.SUV,
            RegistrationNumber = NewRegistrationNumber(),
            Capacity = 4,
            HasAC = true
        });
        Assert.Equal(HttpStatusCode.Unauthorized, anonRes.StatusCode);

        var travelerClient = await TravelerClientAsync();
        var travelerRes = await travelerClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.SUV,
            RegistrationNumber = NewRegistrationNumber(),
            Capacity = 4,
            HasAC = true
        });
        Assert.Equal(HttpStatusCode.Forbidden, travelerRes.StatusCode);
    }

    [Fact]
    public async Task CreateVehicle_FleetCoordinator_ReturnsCreated()
    {
        var coordinatorClient = await StaffClientWithRoleAsync(UserRole.FleetCoordinator);

        var registrationNumber = NewRegistrationNumber();
        var response = await coordinatorClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Van,
            RegistrationNumber = registrationNumber,
            Capacity = 10,
            HasAC = true,
            SeatConfiguration = "Standard 10-seater",
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<VehicleDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.Equal(10, created.Capacity);
        Assert.Equal(VehicleType.Van, created.Type);
        Assert.Equal(registrationNumber.ToUpperInvariant(), created.RegistrationNumber);
        Assert.True(created.HasAC);
    }

    [Fact]
    public async Task CreateVehicle_MissingRegistrationNumber_ReturnsBadRequest()
    {
        var coordinatorClient = await StaffClientWithRoleAsync(UserRole.FleetCoordinator);

        var response = await coordinatorClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Van,
            RegistrationNumber = string.Empty,
            Capacity = 10,
            HasAC = true
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateVehicle_DuplicateRegistrationNumber_ReturnsConflict()
    {
        var coordinatorClient = await StaffClientWithRoleAsync(UserRole.FleetCoordinator);
        var registrationNumber = NewRegistrationNumber();

        var firstResponse = await coordinatorClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Van,
            RegistrationNumber = registrationNumber,
            Capacity = 8,
            HasAC = true
        });
        firstResponse.EnsureSuccessStatusCode();

        // Same plate in a different case/whitespace variant must still collide.
        var duplicateResponse = await coordinatorClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.SUV,
            RegistrationNumber = $" {registrationNumber.ToLowerInvariant()} ",
            Capacity = 4,
            HasAC = true
        });

        Assert.Equal(HttpStatusCode.Conflict, duplicateResponse.StatusCode);
    }

    [Fact]
    public async Task UpdateMaintenanceStatus_UpdatesStatusCorrectly()
    {
        var adminClient = await AdminClientAsync();
        var createResponse = await adminClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.SUV,
            RegistrationNumber = NewRegistrationNumber(),
            Capacity = 5,
            HasAC = true,
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        });
        var vehicle = await createResponse.Content.ReadFromJsonAsync<VehicleDto>(JsonOptions);

        var patchResponse = await adminClient.PatchAsJsonAsync(
            $"/api/vehicles/{vehicle!.Id}/maintenance-status",
            new UpdateMaintenanceStatusRequest { Status = VehicleMaintenanceStatus.OutOfService });

        patchResponse.EnsureSuccessStatusCode();
        var updated = await patchResponse.Content.ReadFromJsonAsync<VehicleDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal(VehicleMaintenanceStatus.OutOfService, updated.MaintenanceStatus);
    }

    [Fact]
    public async Task VehicleAvailability_ChecksMaintenanceAndOverlap()
    {
        var adminClient = await AdminClientAsync();

        // 1. Create a vehicle
        var vehRes = await adminClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Van,
            RegistrationNumber = NewRegistrationNumber(),
            Capacity = 12,
            HasAC = true,
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        });
        var vehicle = await vehRes.Content.ReadFromJsonAsync<VehicleDto>(JsonOptions);

        // 2. Check initial availability: should be true
        var baseDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10));
        var d1 = baseDate;
        var d2 = baseDate.AddDays(1);
        var d3 = baseDate.AddDays(2);
        var d4 = baseDate.AddDays(3);
        var d5 = baseDate.AddDays(4);
        var d6 = baseDate.AddDays(5);
        var d7 = baseDate.AddDays(6);

        var client = _factory.CreateClient();
        var availRes1 = await client.GetAsync($"/api/vehicles/{vehicle!.Id}/availability?from={d1:yyyy-MM-dd}&to={d5:yyyy-MM-dd}");
        availRes1.EnsureSuccessStatusCode();
        var avail1 = await availRes1.Content.ReadFromJsonAsync<VehicleAvailabilityResponse>(JsonOptions);
        Assert.NotNull(avail1);
        Assert.True(avail1.IsAvailable);

        // 3. Create a driver and a booking to assign
        var driverRes = await adminClient.PostAsJsonAsync("/api/drivers", new CreateDriverRequest
        {
            Name = "John Perera",
            LicenseNumber = $"LIC-{Guid.NewGuid():N}",
            ContactInfo = "+94771234567"
        });
        var driver = await driverRes.Content.ReadFromJsonAsync<DriverDto>(JsonOptions);

        // Create booking
        var travelerClient = await TravelerClientAsync();
        var tierRes = await adminClient.GetAsync("/api/packages");
        var packages = await tierRes.Content.ReadFromJsonAsync<List<TourPackageDto>>(JsonOptions);
        var tier = packages![0].Tiers[0];

        var bookingRes = await travelerClient.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = tier.Id,
            GroupSize = 2,
            StartDate = d1,
            EndDate = d5,
            BudgetPerPerson = 500m
        });
        var bookingBody = await bookingRes.Content.ReadAsStringAsync();
        Assert.True(bookingRes.IsSuccessStatusCode, $"Booking create failed: {bookingRes.StatusCode} - {bookingBody}");
        var booking = await bookingRes.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.NotNull(booking);

        // Reserve vehicle for d2 to d4 (overlapping with d1..d5)
        var reserveRes = await adminClient.PostAsJsonAsync($"/api/vehicles/{vehicle.Id}/reservations", new ReserveVehicleRequest
        {
            DriverId = driver!.Id,
            BookingId = booking!.Id,
            StartDate = d2,
            EndDate = d4
        });
        reserveRes.EnsureSuccessStatusCode();

        // 4. Overlap query: d1 to d3 (overlaps d2..d4) -> false
        var availRes2 = await client.GetAsync($"/api/vehicles/{vehicle.Id}/availability?from={d1:yyyy-MM-dd}&to={d3:yyyy-MM-dd}");
        var avail2 = await availRes2.Content.ReadFromJsonAsync<VehicleAvailabilityResponse>(JsonOptions);
        Assert.False(avail2!.IsAvailable);

        // 5. Non-overlapping query: d5 to d7 -> true
        var availRes3 = await client.GetAsync($"/api/vehicles/{vehicle.Id}/availability?from={d5:yyyy-MM-dd}&to={d7:yyyy-MM-dd}");
        var avail3 = await availRes3.Content.ReadFromJsonAsync<VehicleAvailabilityResponse>(JsonOptions);
        Assert.True(avail3!.IsAvailable);

        // 6. Double booking same dates -> returns Conflict 409
        var doubleBookRes = await adminClient.PostAsJsonAsync($"/api/vehicles/{vehicle.Id}/reservations", new ReserveVehicleRequest
        {
            DriverId = driver.Id,
            BookingId = booking.Id,
            StartDate = d3,
            EndDate = d6
        });
        Assert.Equal(HttpStatusCode.Conflict, doubleBookRes.StatusCode);
    }

    [Fact]
    public async Task DriversEndpoints_SupportGetAllGetByIdAndCreate()
    {
        var adminClient = await AdminClientAsync();
        var license = $"B-{Guid.NewGuid():N}";

        var createRes = await adminClient.PostAsJsonAsync("/api/drivers", new CreateDriverRequest
        {
            Name = "Sunil Silva",
            LicenseNumber = license,
            ContactInfo = "+94770000000"
        });
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.Content.ReadFromJsonAsync<DriverDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.Equal("Sunil Silva", created.Name);

        var getRes = await adminClient.GetAsync($"/api/drivers/{created.Id}");
        getRes.EnsureSuccessStatusCode();
        var retrieved = await getRes.Content.ReadFromJsonAsync<DriverDto>(JsonOptions);
        Assert.Equal(created.Id, retrieved!.Id);

        var listRes = await adminClient.GetAsync("/api/drivers");
        listRes.EnsureSuccessStatusCode();
        var drivers = await listRes.Content.ReadFromJsonAsync<List<DriverDto>>(JsonOptions);
        Assert.Contains(drivers!, d => d.Id == created.Id);
    }

    [Fact]
    public async Task DeleteVehicle_AsAdminOrCoordinator_CascadesAssignmentsAndRemovesVehicle()
    {
        var adminClient = await AdminClientAsync();

        // Create vehicle
        var vehicleRes = await adminClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.SUV,
            RegistrationNumber = NewRegistrationNumber(),
            Capacity = 4,
            HasAC = true,
            SeatConfiguration = "2-2",
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        });
        vehicleRes.EnsureSuccessStatusCode();
        var vehicle = await vehicleRes.Content.ReadFromJsonAsync<VehicleDto>(JsonOptions);

        // Delete vehicle
        var deleteRes = await adminClient.DeleteAsync($"/api/vehicles/{vehicle!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteRes.StatusCode);

        // Verify vehicle is not found
        var getRes = await adminClient.GetAsync($"/api/vehicles/{vehicle.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getRes.StatusCode);
    }

    [Fact]
    public async Task GetAssignments_ReturnsAssignmentsWithDetails()
    {
        var staffClient = await StaffClientWithRoleAsync(UserRole.FleetCoordinator);
        var res = await staffClient.GetAsync("/api/vehicles/assignments");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task GetAssignmentByBookingId_TravelerCanRetrieveTheirAssignment()
    {
        var adminClient = await AdminClientAsync();

        // 1. Create vehicle
        var vehicleRes = await adminClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Van,
            RegistrationNumber = NewRegistrationNumber(),
            Capacity = 8,
            HasAC = true,
            SeatConfiguration = "2-2-2-2",
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        });
        var vehicle = await vehicleRes.Content.ReadFromJsonAsync<VehicleDto>(JsonOptions);

        // 2. Create driver
        var driverRes = await adminClient.PostAsJsonAsync("/api/drivers", new CreateDriverRequest
        {
            Name = "Kamal Gunaratne",
            LicenseNumber = $"B-{Guid.NewGuid():N}",
            ContactInfo = "+94712345678"
        });
        var driver = await driverRes.Content.ReadFromJsonAsync<DriverDto>(JsonOptions);

        // 3. Create booking by traveler
        var travelerClient = await TravelerClientAsync();
        var pkgsRes = await adminClient.GetAsync("/api/packages");
        var packages = await pkgsRes.Content.ReadFromJsonAsync<List<TourPackageDto>>(JsonOptions);
        var tier = packages![0].Tiers[0];

        var bookingRes = await travelerClient.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = tier.Id,
            GroupSize = 4,
            StartDate = new DateOnly(2026, 11, 1),
            EndDate = new DateOnly(2026, 11, 5),
            BudgetPerPerson = 450m
        });
        var booking = await bookingRes.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);

        // Before assignment: 404
        var preRes = await travelerClient.GetAsync($"/api/vehicles/assignments/by-booking/{booking!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, preRes.StatusCode);

        // 4. Reserve vehicle as coordinator/admin
        var reserveRes = await adminClient.PostAsJsonAsync($"/api/vehicles/{vehicle!.Id}/reservations", new ReserveVehicleRequest
        {
            DriverId = driver!.Id,
            BookingId = booking.Id,
            StartDate = new DateOnly(2026, 11, 1),
            EndDate = new DateOnly(2026, 11, 5)
        });
        reserveRes.EnsureSuccessStatusCode();

        // 5. Query assignment as the booking's traveler: 200 OK with vehicle & driver details
        var assignedRes = await travelerClient.GetAsync($"/api/vehicles/assignments/by-booking/{booking.Id}");
        Assert.Equal(HttpStatusCode.OK, assignedRes.StatusCode);

        var assignment = await assignedRes.Content.ReadFromJsonAsync<VehicleAssignmentDetailDto>(JsonOptions);
        Assert.NotNull(assignment);
        Assert.Equal(booking.Id, assignment.BookingId);
        Assert.Equal("Kamal Gunaratne", assignment.DriverName);
        Assert.Equal("+94712345678", assignment.DriverContact);
        Assert.Equal(VehicleType.Van, assignment.VehicleType);
        Assert.Equal(8, assignment.Capacity);
        Assert.True(assignment.HasAC);
    }

    [Fact]
    public async Task UpdateDriver_UpdatesDetails_And_DeleteDriver_RemovesDriver()
    {
        var fleetCoordinatorClient = await StaffClientWithRoleAsync(UserRole.FleetCoordinator);

        // 1. Create driver
        var createRes = await fleetCoordinatorClient.PostAsJsonAsync("/api/drivers", new CreateDriverRequest
        {
            Name = "Original Driver",
            LicenseNumber = $"B-{Guid.NewGuid():N}"[..15],
            ContactInfo = "+94770001111"
        });
        createRes.EnsureSuccessStatusCode();
        var driver = await createRes.Content.ReadFromJsonAsync<DriverDto>(JsonOptions);
        Assert.NotNull(driver);

        // 2. Update driver
        var updatedLicense = $"B-UPD-{Guid.NewGuid():N}"[..15];
        var updateRes = await fleetCoordinatorClient.PutAsJsonAsync($"/api/drivers/{driver.Id}", new UpdateDriverRequest
        {
            Name = "Updated Driver",
            LicenseNumber = updatedLicense,
            ContactInfo = "+94779998888"
        });
        Assert.Equal(HttpStatusCode.OK, updateRes.StatusCode);
        var updatedDriver = await updateRes.Content.ReadFromJsonAsync<DriverDto>(JsonOptions);
        Assert.NotNull(updatedDriver);
        Assert.Equal("Updated Driver", updatedDriver.Name);
        Assert.Equal(updatedLicense, updatedDriver.LicenseNumber);
        Assert.Equal("+94779998888", updatedDriver.ContactInfo);

        // 3. Delete driver
        var deleteRes = await fleetCoordinatorClient.DeleteAsync($"/api/drivers/{driver.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteRes.StatusCode);

        // 4. Verify 404
        var getRes = await fleetCoordinatorClient.GetAsync($"/api/drivers/{driver.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getRes.StatusCode);
    }

    [Fact]
    public async Task CreateDriver_DuplicateLicenseNumber_ReturnsConflictWithErrorMessage()
    {
        var fleetCoordinatorClient = await StaffClientWithRoleAsync(UserRole.FleetCoordinator);
        var license = $"B-DUP-{Guid.NewGuid():N}"[..15];

        // 1. First registration succeeds
        var firstRes = await fleetCoordinatorClient.PostAsJsonAsync("/api/drivers", new CreateDriverRequest
        {
            Name = "First Driver",
            LicenseNumber = license,
            ContactInfo = "+94771112222"
        });
        firstRes.EnsureSuccessStatusCode();

        // 2. Second registration with same license (even lowercase) must return 409 Conflict
        var secondRes = await fleetCoordinatorClient.PostAsJsonAsync("/api/drivers", new CreateDriverRequest
        {
            Name = "Second Driver",
            LicenseNumber = license.ToLowerInvariant(),
            ContactInfo = "+94773334444"
        });
        Assert.Equal(HttpStatusCode.Conflict, secondRes.StatusCode);

        var content = await secondRes.Content.ReadAsStringAsync();
        Assert.Contains("Driver License Number already exists", content);
    }

    [Fact]
    public async Task CheckDriverAvailability_ReturnsTrue_AndFalseWhenConflicted()
    {
        var adminClient = await AdminClientAsync();

        // 1. Create a driver
        var driverRes = await adminClient.PostAsJsonAsync("/api/drivers", new CreateDriverRequest
        {
            Name = "Bandara Silva",
            LicenseNumber = $"B-{Guid.NewGuid():N}"[..12],
            ContactInfo = "+94773334444"
        });
        var driver = await driverRes.Content.ReadFromJsonAsync<DriverDto>(JsonOptions);
        Assert.NotNull(driver);

        // 2. Check initial availability: should be true
        var startDate = new DateOnly(2026, 12, 1);
        var endDate = new DateOnly(2026, 12, 5);

        var client = _factory.CreateClient();
        var availBeforeRes = await client.GetAsync($"/api/drivers/{driver.Id}/availability?from={startDate:yyyy-MM-dd}&to={endDate:yyyy-MM-dd}");
        availBeforeRes.EnsureSuccessStatusCode();
        var availBefore = await availBeforeRes.Content.ReadFromJsonAsync<DriverAvailabilityResponse>(JsonOptions);
        Assert.NotNull(availBefore);
        Assert.True(availBefore.IsAvailable);

        // 3. Create vehicle & booking and reserve driver
        var vehRes = await adminClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Van,
            RegistrationNumber = NewRegistrationNumber(),
            Capacity = 8,
            HasAC = true,
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        });
        var vehicle = await vehRes.Content.ReadFromJsonAsync<VehicleDto>(JsonOptions);

        var travelerClient = await TravelerClientAsync();
        var packagesRes = await travelerClient.GetAsync("/api/packages");
        var packages = await packagesRes.Content.ReadFromJsonAsync<IReadOnlyList<TourPackageDto>>(JsonOptions);
        var tier = packages![0].Tiers[0];

        var bookingRes = await travelerClient.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = tier.Id,
            GroupSize = 4,
            StartDate = startDate,
            EndDate = endDate,
            BudgetPerPerson = 500m
        });
        var booking = await bookingRes.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);

        var reserveRes = await adminClient.PostAsJsonAsync($"/api/vehicles/{vehicle!.Id}/reservations", new ReserveVehicleRequest
        {
            DriverId = driver.Id,
            BookingId = booking!.Id,
            StartDate = startDate,
            EndDate = endDate
        });
        reserveRes.EnsureSuccessStatusCode();

        // 4. Now driver should be false for those overlapping dates
        var availAfterRes = await client.GetAsync($"/api/drivers/{driver.Id}/availability?from={startDate:yyyy-MM-dd}&to={endDate:yyyy-MM-dd}");
        var availAfter = await availAfterRes.Content.ReadFromJsonAsync<DriverAvailabilityResponse>(JsonOptions);
        Assert.NotNull(availAfter);
        Assert.False(availAfter.IsAvailable);

        // But available for other non-overlapping dates
        var otherDateRes = await client.GetAsync($"/api/drivers/{driver.Id}/availability?from=2026-12-10&to=2026-12-15");
        var otherDateAvail = await otherDateRes.Content.ReadFromJsonAsync<DriverAvailabilityResponse>(JsonOptions);
        Assert.NotNull(otherDateAvail);
        Assert.True(otherDateAvail.IsAvailable);
    }

    [Fact]
    public async Task CancelBooking_ReleasesVehicleAssignment_RestoresVehicleAvailability()
    {
        var adminClient = await AdminClientAsync();
        var travelerClient = await TravelerClientAsync();

        // 1. Create a vehicle
        var regNum = NewRegistrationNumber();
        var vehicleRes = await adminClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Van,
            RegistrationNumber = regNum,
            Capacity = 8,
            HasAC = true,
            SeatConfiguration = "2-2-2-2",
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        });
        var vehicle = await vehicleRes.Content.ReadFromJsonAsync<VehicleDto>(JsonOptions);
        Assert.NotNull(vehicle);

        // 2. Create a driver
        var driverRes = await adminClient.PostAsJsonAsync("/api/drivers", new CreateDriverRequest
        {
            Name = "Sunil Perera",
            LicenseNumber = $"B-{Guid.NewGuid():N}"[..12],
            ContactInfo = "+94771234567"
        });
        var driver = await driverRes.Content.ReadFromJsonAsync<DriverDto>(JsonOptions);
        Assert.NotNull(driver);

        // 3. Create a booking
        var packagesRes = await travelerClient.GetAsync("/api/packages");
        var packages = await packagesRes.Content.ReadFromJsonAsync<IReadOnlyList<TourPackageDto>>(JsonOptions);
        var tier = packages![0].Tiers[0];

        var startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(40));
        var endDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(45));

        var bookingRes = await travelerClient.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = tier.Id,
            GroupSize = 4,
            StartDate = startDate,
            EndDate = endDate,
            BudgetPerPerson = 500m
        });
        var booking = await bookingRes.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.NotNull(booking);

        // 4. Reserve vehicle for the booking
        var reserveRes = await adminClient.PostAsJsonAsync($"/api/vehicles/{vehicle.Id}/reservations", new ReserveVehicleRequest
        {
            DriverId = driver.Id,
            BookingId = booking.Id,
            StartDate = startDate,
            EndDate = endDate
        });
        reserveRes.EnsureSuccessStatusCode();

        // Check vehicle availability: should now be false for that date window
        var availBefore = await adminClient.GetAsync($"/api/vehicles/{vehicle.Id}/availability?from={startDate:yyyy-MM-dd}&to={endDate:yyyy-MM-dd}");
        var availBeforeObj = await availBefore.Content.ReadFromJsonAsync<VehicleAvailabilityResponse>(JsonOptions);
        Assert.NotNull(availBeforeObj);
        Assert.False(availBeforeObj.IsAvailable);

        // 5. Cancel the booking as traveler
        var cancelRes = await travelerClient.PatchAsJsonAsync($"/api/bookings/{booking.Id}/cancel", new
        {
            Reason = "Trip cancelled by traveler"
        });
        cancelRes.EnsureSuccessStatusCode();

        // 6. Verify vehicle assignment is cleanly released and availability is restored
        var availAfter = await adminClient.GetAsync($"/api/vehicles/{vehicle.Id}/availability?from={startDate:yyyy-MM-dd}&to={endDate:yyyy-MM-dd}");
        var availAfterObj = await availAfter.Content.ReadFromJsonAsync<VehicleAvailabilityResponse>(JsonOptions);
        Assert.NotNull(availAfterObj);
        Assert.True(availAfterObj.IsAvailable);

        // Query assignment by booking id should return 404
        var assignmentRes = await travelerClient.GetAsync($"/api/vehicles/assignments/by-booking/{booking.Id}");
        Assert.Equal(HttpStatusCode.NotFound, assignmentRes.StatusCode);
    }

    [Fact]
    public async Task Driver_CanLogin_And_QueryAssignedToursPortal()
    {
        var adminClient = await AdminClientAsync();

        // 1. Create a Driver staff user
        var driverEmail = $"driver-{Guid.NewGuid():N}@example.com";
        var driverPassword = "P@ssword123!";
        var driverName = "Perera Driver";
        var driverContact = "+94778889999";

        var createUserRes = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = driverName,
            Email = driverEmail,
            Password = driverPassword,
            ContactNumber = driverContact,
            Role = "Driver"
        });
        createUserRes.EnsureSuccessStatusCode();

        // 2. Log in as Driver
        var driverClient = _factory.CreateClient();
        var loginRes = await driverClient.PostAsJsonAsync("/api/auth/login", new
        {
            Email = driverEmail,
            Password = driverPassword
        });
        loginRes.EnsureSuccessStatusCode();
        var auth = await loginRes.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        Assert.NotNull(auth);
        Assert.Equal("Driver", auth.User.Role.ToString());
        driverClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);

        // Initially no assignments
        var initialRes = await driverClient.GetAsync("/api/drivers/me/assignments");
        initialRes.EnsureSuccessStatusCode();
        var initialList = await initialRes.Content.ReadFromJsonAsync<List<VehicleAssignmentDetailDto>>(JsonOptions);
        Assert.NotNull(initialList);
        Assert.Empty(initialList);

        // 3. Admin creates a vehicle & reserves for a booking assigned to this driver
        var regNo = NewRegistrationNumber();
        var vehicleRes = await adminClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Van,
            RegistrationNumber = regNo,
            Capacity = 8,
            HasAC = true,
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        });
        var vehicle = await vehicleRes.Content.ReadFromJsonAsync<VehicleDto>(JsonOptions);

        var driversRes = await adminClient.GetAsync("/api/drivers");
        var drivers = await driversRes.Content.ReadFromJsonAsync<List<DriverDto>>(JsonOptions);
        var driverProfile = drivers!.FirstOrDefault(d => d.Name == driverName);
        Assert.NotNull(driverProfile);

        var travelerClient = await TravelerClientAsync();
        var pkgsRes = await adminClient.GetAsync("/api/packages");
        var packages = await pkgsRes.Content.ReadFromJsonAsync<List<TourPackageDto>>(JsonOptions);
        var tier = packages![0].Tiers[0];

        var bookingRes = await travelerClient.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = tier.Id,
            GroupSize = 3,
            StartDate = new DateOnly(2026, 12, 1),
            EndDate = new DateOnly(2026, 12, 5),
            BudgetPerPerson = 400m
        });
        var booking = await bookingRes.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);

        var reserveRes = await adminClient.PostAsJsonAsync($"/api/vehicles/{vehicle!.Id}/reservations", new ReserveVehicleRequest
        {
            DriverId = driverProfile.Id,
            BookingId = booking!.Id,
            StartDate = new DateOnly(2026, 12, 1),
            EndDate = new DateOnly(2026, 12, 5)
        });
        reserveRes.EnsureSuccessStatusCode();

        // 4. Query driver assignments endpoint
        var myAssignmentsRes = await driverClient.GetAsync("/api/drivers/me/assignments");
        myAssignmentsRes.EnsureSuccessStatusCode();
        var myAssignments = await myAssignmentsRes.Content.ReadFromJsonAsync<List<VehicleAssignmentDetailDto>>(JsonOptions);
        Assert.NotNull(myAssignments);
        Assert.Single(myAssignments);

        var assignment = myAssignments[0];
        Assert.Equal(booking.Id, assignment.BookingId);
        Assert.Equal(driverProfile.Id, assignment.DriverId);
        Assert.Equal(vehicle!.RegistrationNumber, assignment.RegistrationNumber);
        Assert.Equal(VehicleType.Van, assignment.VehicleType);
        Assert.True(assignment.HasAC);
        Assert.NotNull(assignment.TravelerName);
        Assert.NotNull(assignment.TravelerContact);
        Assert.NotNull(assignment.PackageName);
        Assert.NotNull(assignment.PackageTier);
    }

    [Fact]
    public async Task CreateDriver_WithEmailAndPassword_ProvisionsUserAccountAndEnablesLogin()
    {
        var adminClient = await AdminClientAsync();

        // 1. Create a driver with email and password via coordinator/admin endpoint
        var driverEmail = $"driver-{Guid.NewGuid():N}@trailwise.local";
        var driverPassword = "DriverPass123!";
        var driverName = "Dynamic Pro Driver";

        var createDriverRes = await adminClient.PostAsJsonAsync("/api/drivers", new CreateDriverRequest
        {
            Name = driverName,
            ContactInfo = "+94770001122",
            LicenseNumber = $"LIC-{Guid.NewGuid():N}"[..10],
            Email = driverEmail,
            Password = driverPassword
        });
        createDriverRes.EnsureSuccessStatusCode();
        var createdDriver = await createDriverRes.Content.ReadFromJsonAsync<DriverDto>(JsonOptions);
        Assert.NotNull(createdDriver);
        Assert.Equal(driverEmail, createdDriver.Email);
        Assert.NotNull(createdDriver.UserId);

        // 2. Driver should be able to log in directly using the provisioned credentials
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            Email = driverEmail,
            Password = driverPassword
        });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        Assert.NotNull(auth);
        Assert.Equal(UserRole.Driver, auth.User.Role);

        // 3. Authenticate with this newly provisioned driver token and check assignments
        var driverClient = _factory.CreateClient();
        driverClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);

        var myAssignmentsRes = await driverClient.GetAsync("/api/drivers/me/assignments");
        myAssignmentsRes.EnsureSuccessStatusCode();
        var myAssignments = await myAssignmentsRes.Content.ReadFromJsonAsync<List<VehicleAssignmentDetailDto>>(JsonOptions);
        Assert.NotNull(myAssignments);
        Assert.Empty(myAssignments);
    }

    private static string NewRegistrationNumber() => $"REG-{Guid.NewGuid():N}"[..12];

    private async Task<HttpClient> AdminClientAsync()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<HttpClient> TravelerClientAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Traveler", Email = email, Password = "P@ssword123", ContactNumber = "+14155550199" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<HttpClient> StaffClientWithRoleAsync(UserRole role)
    {
        var admin = await AdminClientAsync();
        var email = $"staff-{role.ToString().ToLower()}-{Guid.NewGuid():N}@example.com";
        await admin.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = $"Staff {role}",
            Email = email,
            Password = "P@ssword123",
            ContactNumber = "+14155550198",
            Role = role.ToString()
        });

        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
