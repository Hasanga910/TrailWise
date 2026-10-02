using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Api.Contracts.Fleet;
using TrailWise.Api.Contracts.Payments;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class ManualConfirmationLifecycleTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public ManualConfirmationLifecycleTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private class TestClock : IClock
    {
        public DateTimeOffset UtcNow { get; set; } = new(2026, 10, 1, 10, 0, 0, TimeSpan.Zero);
    }

    // 1. Decide approval sets Confirmed + PaymentDueAt
    [Fact]
    public async Task Test01_Decide_Approval_Sets_Confirmed_And_PaymentDueAt()
    {
        var admin = await AdminClientAsync();
        var opsManager = await OperationsManagerClientAsync(admin);

        var booking = await SeedBookingAsync(BookingStatus.NeedsManualReview);

        // Seed guide availability
        using (var guideScope = _factory.Services.CreateScope())
        {
            var guideDb = guideScope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var guide = new Guide
            {
                Name = "Guide Approver",
                ContactInfo = "+94771112233",
                Specializations = new[] { "Cultural" },
                Languages = new[] { "English" }
            };
            guideDb.Guides.Add(guide);
            guideDb.GuideAvailabilities.Add(new GuideAvailability
            {
                Guide = guide,
                Date = booking.StartDate,
                IsAvailable = false,
                AssignedBookingId = booking.Id
            });

            // Also seed vehicle & driver assignment for the booking
            var v = new Vehicle
            {
                Type = VehicleType.Van,
                RegistrationNumber = $"REG-{Guid.NewGuid():N}"[..10],
                Capacity = 8,
                HasAC = true,
                SeatConfiguration = "2-2-2-2",
                MaintenanceStatus = VehicleMaintenanceStatus.Available
            };
            var d = new Driver
            {
                Name = "Decide Driver",
                LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10],
                ContactInfo = "+94770000001"
            };
            guideDb.Vehicles.Add(v);
            guideDb.Drivers.Add(d);
            guideDb.VehicleAssignments.Add(new VehicleAssignment
            {
                Vehicle = v,
                Driver = d,
                BookingId = booking.Id,
                StartDate = booking.StartDate,
                EndDate = booking.EndDate
            });

            await guideDb.SaveChangesAsync();
        }

        var response = await opsManager.PostAsJsonAsync(
            $"/api/bookings/{booking.Id}/decide",
            new BookingDecisionRequest { Decision = BookingDecision.Approve, Notes = "Manual approval test" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.NotNull(result);
        Assert.Equal(BookingStatus.Confirmed, result.Status);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var updated = await db.Bookings.FindAsync(booking.Id);
        Assert.NotNull(updated);
        Assert.Equal(BookingStatus.Confirmed, updated.Status);
        Assert.NotNull(updated.PaymentDueAt);
        Assert.True(updated.PaymentDueAt > DateTimeOffset.UtcNow);
    }

    // 2. AssignGuide confirmation sets Confirmed + PaymentDueAt
    [Fact]
    public async Task Test02_AssignGuide_Confirmation_Sets_Confirmed_And_PaymentDueAt()
    {
        var admin = await AdminClientAsync();
        var opsManager = await OperationsManagerClientAsync(admin);

        var guide = await CreateGuideAsync("Guide Sunimal");
        var startDate = new DateOnly(2026, 12, 1);
        var endDate = new DateOnly(2026, 12, 3);
        var booking = await SeedBookingAsync(BookingStatus.NeedsManualReview, startDate, endDate);

        // Pre-assign vehicle & driver so AssignGuide completes all 3 resources and triggers Confirmed
        using (var vScope = _factory.Services.CreateScope())
        {
            var vDb = vScope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var v = new Vehicle
            {
                Type = VehicleType.Van,
                RegistrationNumber = $"REG-{Guid.NewGuid():N}"[..10],
                Capacity = 8,
                HasAC = true,
                SeatConfiguration = "2-2-2-2",
                MaintenanceStatus = VehicleMaintenanceStatus.Available
            };
            var d = new Driver
            {
                Name = "Guide Test Driver",
                LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10],
                ContactInfo = "+94770000002"
            };
            vDb.Vehicles.Add(v);
            vDb.Drivers.Add(d);
            vDb.VehicleAssignments.Add(new VehicleAssignment
            {
                Vehicle = v,
                Driver = d,
                BookingId = booking.Id,
                StartDate = startDate,
                EndDate = endDate
            });
            await vDb.SaveChangesAsync();
        }

        var response = await opsManager.PostAsJsonAsync(
            $"/api/bookings/{booking.Id}/assign-guide",
            new { GuideId = guide.Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var updated = await db.Bookings.FindAsync(booking.Id);
        Assert.NotNull(updated);
        Assert.Equal(BookingStatus.Confirmed, updated.Status);
        Assert.NotNull(updated.PaymentDueAt);
        Assert.True(updated.PaymentDueAt > DateTimeOffset.UtcNow);
    }

    // 3. Manual fleet confirmation sets Confirmed + PaymentDueAt
    [Fact]
    public async Task Test03_ManualFleetConfirmation_Sets_Confirmed_And_PaymentDueAt()
    {
        var adminClient = await AdminClientAsync();

        // 1. Create a vehicle
        var vanResponse = await adminClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Van,
            RegistrationNumber = $"REG-{Guid.NewGuid():N}"[..12],
            Capacity = 8,
            HasAC = true,
            SeatConfiguration = "2-2-2-2",
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        });
        vanResponse.EnsureSuccessStatusCode();
        var vehicle = await vanResponse.Content.ReadFromJsonAsync<VehicleDto>(JsonOptions);

        // 2. Create a driver
        var driverResponse = await adminClient.PostAsJsonAsync("/api/drivers", new CreateDriverRequest
        {
            Name = "Fleet Driver",
            LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10],
            ContactInfo = "+94712345678"
        });
        driverResponse.EnsureSuccessStatusCode();
        var driver = await driverResponse.Content.ReadFromJsonAsync<DriverDto>(JsonOptions);

        // 3. Create a guide
        var guide = await CreateGuideAsync("Fleet Guide");

        // 4. Seed booking in NeedsManualReview
        var startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(20));
        var endDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(24));
        var booking = await SeedBookingAsync(BookingStatus.NeedsManualReview, startDate, endDate);

        // 5. Reserve vehicle and guide for the booking
        var reserveRes = await adminClient.PostAsJsonAsync($"/api/vehicles/{vehicle!.Id}/reservations", new ReserveVehicleRequest
        {
            DriverId = driver!.Id,
            BookingId = booking.Id,
            StartDate = startDate,
            EndDate = endDate,
            GuideId = guide.Id
        });
        reserveRes.EnsureSuccessStatusCode();

        // 6. Verify booking is now Confirmed and PaymentDueAt is set
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var updated = await db.Bookings.FindAsync(booking.Id);
        Assert.NotNull(updated);
        Assert.Equal(BookingStatus.Confirmed, updated.Status);
        Assert.NotNull(updated.PaymentDueAt);
        Assert.True(updated.PaymentDueAt > DateTimeOffset.UtcNow);
    }

    [Fact]
    public async Task Test03B_UnifiedFleetAndGuideAllocation_AssignsAllThreeResources_AndConfirms()
    {
        var adminClient = await AdminClientAsync();

        // 1. Create a vehicle
        var vanResponse = await adminClient.PostAsJsonAsync("/api/vehicles", new CreateVehicleRequest
        {
            Type = VehicleType.Van,
            RegistrationNumber = $"REG-{Guid.NewGuid():N}"[..12],
            Capacity = 8,
            HasAC = true,
            SeatConfiguration = "2-2-2-2",
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        });
        vanResponse.EnsureSuccessStatusCode();
        var vehicle = await vanResponse.Content.ReadFromJsonAsync<VehicleDto>(JsonOptions);

        // 2. Create a driver
        var driverResponse = await adminClient.PostAsJsonAsync("/api/drivers", new CreateDriverRequest
        {
            Name = "Unified Driver",
            LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10],
            ContactInfo = "+94719999999"
        });
        driverResponse.EnsureSuccessStatusCode();
        var driver = await driverResponse.Content.ReadFromJsonAsync<DriverDto>(JsonOptions);

        // 3. Create a guide
        var guide = await CreateGuideAsync("Unified Guide");

        // 4. Seed booking in NeedsManualReview
        var startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var endDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(33));
        var booking = await SeedBookingAsync(BookingStatus.NeedsManualReview, startDate, endDate);

        // 5. Reserve vehicle, driver, and guide simultaneously
        var reserveRes = await adminClient.PostAsJsonAsync($"/api/vehicles/{vehicle!.Id}/reservations", new ReserveVehicleRequest
        {
            DriverId = driver!.Id,
            BookingId = booking.Id,
            StartDate = startDate,
            EndDate = endDate,
            GuideId = guide.Id
        });
        reserveRes.EnsureSuccessStatusCode();

        // 6. Verify booking is Confirmed and both VehicleAssignment and GuideAvailability exist
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var updated = await db.Bookings.FindAsync(booking.Id);
            Assert.NotNull(updated);
            Assert.Equal(BookingStatus.Confirmed, updated.Status);

            var vehicleAssignment = await db.VehicleAssignments.FirstOrDefaultAsync(a => a.BookingId == booking.Id);
            Assert.NotNull(vehicleAssignment);
            Assert.Equal(vehicle.Id, vehicleAssignment.VehicleId);
            Assert.Equal(driver.Id, vehicleAssignment.DriverId);

            var guideAvailabilities = await db.GuideAvailabilities
                .Where(a => a.GuideId == guide.Id && a.AssignedBookingId == booking.Id)
                .ToListAsync();
            Assert.NotEmpty(guideAvailabilities);
        }

        // 7. Attempting to assign the same guide to another booking in overlapping dates fails with conflict
        var overlappingBooking = await SeedBookingAsync(BookingStatus.NeedsManualReview, startDate, endDate);
        var secondReserveRes = await adminClient.PostAsJsonAsync($"/api/vehicles/{vehicle!.Id}/reservations", new ReserveVehicleRequest
        {
            DriverId = driver!.Id,
            BookingId = overlappingBooking.Id,
            StartDate = startDate,
            EndDate = endDate,
            GuideId = guide.Id
        });
        Assert.Equal(HttpStatusCode.Conflict, secondReserveRes.StatusCode);
    }

    // 4. Existing PaymentDueAt is not overwritten
    [Fact]
    public void Test04_Existing_PaymentDueAt_Is_Not_Overwritten()
    {
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 10, 1, 10, 0, 0, TimeSpan.Zero) };
        var lifecycle = new BookingLifecycleService(clock);

        var existingDeadline = clock.UtcNow.AddMinutes(35);
        var booking = new Booking
        {
            TourPackageId = Guid.NewGuid(),
            PackageTierId = Guid.NewGuid(),
            TravelerId = Guid.NewGuid(),
            StartDate = new DateOnly(2026, 11, 1),
            EndDate = new DateOnly(2026, 11, 5),
            GroupSize = 2,
            BudgetPerPerson = 150m,
            Status = BookingStatus.NeedsManualReview,
            PaymentDueAt = existingDeadline
        };

        var transitioned = lifecycle.TransitionToConfirmed(booking);
        Assert.True(transitioned);
        Assert.Equal(BookingStatus.Confirmed, booking.Status);
        Assert.Equal(existingDeadline, booking.PaymentDueAt); // NOT overwritten
    }

    // 5. PaymentStatusDto includes bookingStatus contract
    [Fact]
    public void Test05_PaymentStatusDto_Includes_BookingStatus()
    {
        var dto = new PaymentStatusDto(
            BookingId: Guid.NewGuid(),
            TotalCost: 1000m,
            TotalPaid: 500m,
            RemainingAmount: 500m,
            Status: "DepositPaid",
            BookingStatus: "Completed");

        var json = JsonSerializer.Serialize(dto, JsonOptions);
        Assert.Contains("\"bookingStatus\":\"Completed\"", json);

        var deserialized = JsonSerializer.Deserialize<PaymentStatusDto>(json, JsonOptions);
        Assert.NotNull(deserialized);
        Assert.Equal("Completed", deserialized.BookingStatus);
    }

    // 6. PaymentStatusDto returns Confirmed correctly via API
    [Fact]
    public async Task Test06_PaymentStatusDto_Returns_Confirmed_Correctly()
    {
        var (client, travelerId) = await TravelerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Confirmed, travelerId: travelerId);

        var response = await client.GetAsync($"/api/bookings/{booking.Id}/payment-status");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var dto = await response.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);
        Assert.NotNull(dto);
        Assert.Equal("Confirmed", dto.BookingStatus);
    }

    // 7. PaymentStatusDto returns Completed correctly via API
    [Fact]
    public async Task Test07_PaymentStatusDto_Returns_Completed_Correctly()
    {
        var (client, travelerId) = await TravelerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Completed, travelerId: travelerId);

        var response = await client.GetAsync($"/api/bookings/{booking.Id}/payment-status");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var dto = await response.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);
        Assert.NotNull(dto);
        Assert.Equal("Completed", dto.BookingStatus);
    }

    private async Task<Booking> SeedBookingAsync(
        BookingStatus status,
        DateOnly? startDate = null,
        DateOnly? endDate = null,
        Guid? travelerId = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var tId = travelerId ?? Guid.NewGuid();

        var package = new TourPackage
        {
            Name = $"Test Tour {Guid.NewGuid():N}",
            Theme = "Adventure",
            DurationDays = 3,
            BasePricePerPerson = 150m,
            MaxGroupSize = 10
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = true,
            BasePricePerPerson = 150m,
            RequiresAC = false
        };
        var booking = new Booking
        {
            TravelerId = tId,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = startDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
            EndDate = endDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(13)),
            BudgetPerPerson = 500m,
            Status = status,
            PaymentDueAt = null
        };

        db.Bookings.Add(booking);

        var run = new AgentWorkflowRun
        {
            BookingId = booking.Id,
            Objective = "Pricing Test",
            Status = "Completed",
            StartedAt = DateTimeOffset.UtcNow
        };
        db.AgentWorkflowRuns.Add(run);

        var stepLog = new AgentStepLog
        {
            WorkflowRun = run,
            AgentName = "PricingValidationAgent",
            InputJson = JsonSerializer.Serialize(new { bookingId = booking.Id }),
            OutputJson = JsonSerializer.Serialize(new
            {
                totalCost = 300m,
                breakdown = "{}",
                validationResult = "Valid"
            }),
            DurationMs = 10
        };
        db.AgentStepLogs.Add(stepLog);

        await db.SaveChangesAsync();
        return booking;
    }

    private async Task<Guide> CreateGuideAsync(string name)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var guide = new Guide
        {
            Name = name,
            ContactInfo = "+94770000000",
            Specializations = new[] { "Cultural", "Wildlife" },
            Languages = new[] { "English" }
        };
        db.Guides.Add(guide);
        await db.SaveChangesAsync();
        return guide;
    }

    private async Task<HttpClient> AdminClientAsync()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<HttpClient> OperationsManagerClientAsync(HttpClient adminClient)
    {
        var client = _factory.CreateClient();
        var email = $"ops-{Guid.NewGuid():N}@example.com";
        var password = "P@ssword123";

        var createResponse = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Test Ops Manager",
            Email = email,
            Password = password,
            ContactNumber = "+14155550333",
            Role = "OperationsManager"
        });
        createResponse.EnsureSuccessStatusCode();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            Email = email,
            Password = password
        });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<(HttpClient Client, Guid TravelerId)> TravelerClientAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        var password = "P@ssword123";

        var regResponse = await client.PostAsJsonAsync("/api/auth/register", new
        {
            Name = "Traveler Tester",
            Email = email,
            Password = password,
            ContactNumber = "+14155550444"
        });
        regResponse.EnsureSuccessStatusCode();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            Email = email,
            Password = password
        });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth!.User.Id);
    }
}
