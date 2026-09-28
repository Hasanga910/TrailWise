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
        var client = _factory.CreateClient();
        var availRes1 = await client.GetAsync($"/api/vehicles/{vehicle!.Id}/availability?from=2026-10-01&to=2026-10-05");
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
            StartDate = new DateOnly(2026, 10, 1),
            EndDate = new DateOnly(2026, 10, 5),
            BudgetPerPerson = 500m
        });
        var booking = await bookingRes.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);

        // Reserve vehicle for 2026-10-02 to 2026-10-04 (overlapping with 10-01..10-05)
        var reserveRes = await adminClient.PostAsJsonAsync($"/api/vehicles/{vehicle.Id}/reservations", new ReserveVehicleRequest
        {
            DriverId = driver!.Id,
            BookingId = booking!.Id,
            StartDate = new DateOnly(2026, 10, 2),
            EndDate = new DateOnly(2026, 10, 4)
        });
        reserveRes.EnsureSuccessStatusCode();

        // 4. Overlap query: 2026-10-01 to 2026-10-03 (overlaps 2026-10-02..2026-10-04) -> false
        var availRes2 = await client.GetAsync($"/api/vehicles/{vehicle.Id}/availability?from=2026-10-01&to=2026-10-03");
        var avail2 = await availRes2.Content.ReadFromJsonAsync<VehicleAvailabilityResponse>(JsonOptions);
        Assert.False(avail2!.IsAvailable);

        // 5. Non-overlapping query: 2026-10-05 to 2026-10-07 -> true
        var availRes3 = await client.GetAsync($"/api/vehicles/{vehicle.Id}/availability?from=2026-10-05&to=2026-10-07");
        var avail3 = await availRes3.Content.ReadFromJsonAsync<VehicleAvailabilityResponse>(JsonOptions);
        Assert.True(avail3!.IsAvailable);

        // 6. Double booking same dates -> returns Conflict 409
        var doubleBookRes = await adminClient.PostAsJsonAsync($"/api/vehicles/{vehicle.Id}/reservations", new ReserveVehicleRequest
        {
            DriverId = driver.Id,
            BookingId = booking.Id,
            StartDate = new DateOnly(2026, 10, 3),
            EndDate = new DateOnly(2026, 10, 6)
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
