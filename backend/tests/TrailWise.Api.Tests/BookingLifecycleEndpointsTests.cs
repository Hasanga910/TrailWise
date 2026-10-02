using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Api.Contracts.Common;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class BookingLifecycleEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public BookingLifecycleEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Decide_Approve_FromPendingApproval_SetsConfirmedAndCompletesWorkflowRun()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.PendingApproval);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var booking = await db.Bookings.FindAsync(bookingId);

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
                Name = "Pending Driver",
                LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10],
                ContactInfo = "+94770000003"
            };
            var g = new Guide
            {
                Name = "Pending Guide",
                Specializations = new[] { "General" },
                Languages = new[] { "English" }
            };
            db.Vehicles.Add(v);
            db.Drivers.Add(d);
            db.Guides.Add(g);
            db.VehicleAssignments.Add(new VehicleAssignment
            {
                Vehicle = v,
                Driver = d,
                BookingId = bookingId,
                StartDate = booking!.StartDate,
                EndDate = booking.EndDate
            });
            db.GuideAvailabilities.Add(new GuideAvailability
            {
                Guide = g,
                Date = booking.StartDate,
                IsAvailable = false,
                AssignedBookingId = bookingId
            });

            db.AgentWorkflowRuns.Add(new AgentWorkflowRun
            {
                BookingId = bookingId,
                Objective = "Test objective.",
                PlanJson = "{}",
                Status = "AwaitingApproval",
                StartedAt = DateTimeOffset.UtcNow.AddMinutes(-1)
            });
            await db.SaveChangesAsync();
        }

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Approve",
            Notes = "Looks good."
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Confirmed", updated!.Status.ToString());

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var run = await verifyDb.AgentWorkflowRuns
            .Include(r => r.StepLogs)
            .FirstAsync(r => r.BookingId == bookingId);
        Assert.Equal("Completed", run.Status);
        Assert.NotNull(run.CompletedAt);
        Assert.Contains(run.StepLogs, s => s.AgentName == "manager_decision");
    }

    [Fact]
    public async Task Decide_Reject_FromNeedsManualReview_SetsCancelled()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.NeedsManualReview);

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Reject",
            Notes = "Budget too low."
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Cancelled", updated!.Status.ToString());
    }

    [Fact]
    public async Task Decide_Approve_FromNeedsManualReview_WithoutAssignedGuide_ReturnsConflict_AndKeepsNeedsManualReview()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.NeedsManualReview);

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Approve",
            Notes = "Premature approval."
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var freshBooking = await db.Bookings.FindAsync(bookingId);
        Assert.NotNull(freshBooking);
        Assert.Equal(BookingStatus.NeedsManualReview, freshBooking.Status);
    }

    [Fact]
    public async Task Decide_Approve_FromNeedsManualReview_WithAssignedGuide_SetsConfirmed()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.NeedsManualReview);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var booking = await db.Bookings.FindAsync(bookingId);
            var guide = new Guide
            {
                Name = "Assigned Guide",
                Specializations = new[] { "Wildlife" },
                Languages = new[] { "English" },
                ContactInfo = "guide@example.com"
            };
            var vehicle = new Vehicle
            {
                Type = VehicleType.Van,
                RegistrationNumber = $"REG-{Guid.NewGuid():N}"[..10],
                Capacity = 8,
                HasAC = true,
                SeatConfiguration = "2-2-2-2",
                MaintenanceStatus = VehicleMaintenanceStatus.Available
            };
            var driver = new Driver
            {
                Name = "Needs Review Driver",
                LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10],
                ContactInfo = "+94770000004"
            };
            db.Vehicles.Add(vehicle);
            db.Drivers.Add(driver);
            db.Guides.Add(guide);
            db.VehicleAssignments.Add(new VehicleAssignment
            {
                Vehicle = vehicle,
                Driver = driver,
                BookingId = bookingId,
                StartDate = booking!.StartDate,
                EndDate = booking.EndDate
            });
            db.GuideAvailabilities.Add(new GuideAvailability
            {
                Guide = guide,
                Date = booking!.StartDate,
                IsAvailable = false,
                AssignedBookingId = bookingId
            });
            await db.SaveChangesAsync();
        }

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Approve",
            Notes = "Guide assigned, approval valid."
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Confirmed", updated!.Status.ToString());
    }

    [Fact]
    public async Task Decide_WithoutExistingWorkflowRun_StillSucceeds()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.PendingApproval);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var booking = await db.Bookings.FindAsync(bookingId);
            var vehicle = new Vehicle
            {
                Type = VehicleType.Van,
                RegistrationNumber = $"REG-{Guid.NewGuid():N}"[..10],
                Capacity = 8,
                HasAC = true,
                SeatConfiguration = "2-2-2-2",
                MaintenanceStatus = VehicleMaintenanceStatus.Available
            };
            var driver = new Driver
            {
                Name = "Direct Driver",
                LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10],
                ContactInfo = "+94770000005"
            };
            var guide = new Guide
            {
                Name = "Direct Guide",
                Specializations = new[] { "General" },
                Languages = new[] { "English" }
            };
            db.Vehicles.Add(vehicle);
            db.Drivers.Add(driver);
            db.Guides.Add(guide);
            db.VehicleAssignments.Add(new VehicleAssignment
            {
                Vehicle = vehicle,
                Driver = driver,
                BookingId = bookingId,
                StartDate = booking!.StartDate,
                EndDate = booking.EndDate
            });
            db.GuideAvailabilities.Add(new GuideAvailability
            {
                Guide = guide,
                Date = booking.StartDate,
                IsAvailable = false,
                AssignedBookingId = bookingId
            });
            await db.SaveChangesAsync();
        }

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Approve"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Decide_Approve_AutoAssignsVehicleAndDriverFromWorkflowStepLog()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.PlanProposed);

        Guid vehicleId;
        Guid driverId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var booking = await db.Bookings.FindAsync(bookingId);

            var vehicle = new Vehicle
            {
                Type = VehicleType.Van,
                RegistrationNumber = $"AUTO-{Guid.NewGuid():N}"[..10],
                Capacity = 10,
                HasAC = true,
                MaintenanceStatus = VehicleMaintenanceStatus.Available
            };
            var driver = new Driver
            {
                Name = "Auto Driver",
                ContactInfo = "0771234567"
            };
            var guide = new Guide
            {
                Name = "Auto Guide",
                Specializations = new[] { "General" },
                Languages = new[] { "English" }
            };
            db.Vehicles.Add(vehicle);
            db.Drivers.Add(driver);
            db.Guides.Add(guide);
            db.GuideAvailabilities.Add(new GuideAvailability
            {
                Guide = guide,
                Date = booking!.StartDate,
                IsAvailable = false,
                AssignedBookingId = bookingId
            });
            await db.SaveChangesAsync();

            vehicleId = vehicle.Id;
            driverId = driver.Id;

            var run = new AgentWorkflowRun
            {
                BookingId = bookingId,
                Objective = "Test objective.",
                PlanJson = "{}",
                Status = "AwaitingApproval",
                StartedAt = DateTimeOffset.UtcNow.AddMinutes(-1)
            };
            db.AgentWorkflowRuns.Add(run);
            await db.SaveChangesAsync();

            db.AgentStepLogs.Add(new AgentStepLog
            {
                WorkflowRunId = run.Id,
                AgentName = "FleetCapacityAgent",
                InputJson = "{}",
                OutputJson = $"{{\"vehicleId\":\"{vehicleId}\",\"driverId\":\"{driverId}\"}}",
                DurationMs = 10
            });
            await db.SaveChangesAsync();
        }

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Approve",
            Notes = "Approved plan"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using (var verifyScope = _factory.Services.CreateScope())
        {
            var verifyDb = verifyScope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var assignment = await verifyDb.VehicleAssignments.FirstOrDefaultAsync(a => a.BookingId == bookingId);
            Assert.NotNull(assignment);
            Assert.Equal(vehicleId, assignment.VehicleId);
            Assert.Equal(driverId, assignment.DriverId);
        }
    }

    [Fact]
    public async Task Decide_OnConfirmedBooking_ReturnsConflict()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.Confirmed);

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Approve"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Decide_WithTravelerToken_ReturnsForbidden()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.PendingApproval);

        var travelerClient = await AuthenticatedTravelerAsync();
        var response = await travelerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Approve"
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Decide_WithNonexistentBooking_ReturnsNotFound()
    {
        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{Guid.NewGuid()}/decision", new
        {
            Decision = "Approve"
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetById_WithAssignedGuide_ReturnsAssignedGuideDetails()
    {
        var (travelerClient, bookingId, _) = await SetupBookingAsync(BookingStatus.Confirmed);
        var expectedGuideId = Guid.NewGuid();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var booking = await db.Bookings.FindAsync(bookingId);
            var guide = new Guide
            {
                Id = expectedGuideId,
                Name = "Janindu Perera",
                Specializations = new[] { "Cultural", "Wildlife" },
                Languages = new[] { "Sinhala", "English" },
                ContactInfo = "0771234567"
            };
            db.Guides.Add(guide);
            db.GuideAvailabilities.Add(new GuideAvailability
            {
                GuideId = expectedGuideId,
                Date = booking!.StartDate,
                IsAvailable = false,
                AssignedBookingId = bookingId
            });
            await db.SaveChangesAsync();
        }

        var response = await travelerClient.GetAsync($"/api/bookings/{bookingId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var bookingDto = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.NotNull(bookingDto);
        Assert.NotNull(bookingDto.AssignedGuide);
        Assert.Equal(expectedGuideId, bookingDto.AssignedGuide.Id);
        Assert.Equal("Janindu Perera", bookingDto.AssignedGuide.Name);
        Assert.Equal("0771234567", bookingDto.AssignedGuide.ContactInfo);
        Assert.Equal(new[] { "Sinhala", "English" }, bookingDto.AssignedGuide.Languages);
        Assert.Equal(new[] { "Cultural", "Wildlife" }, bookingDto.AssignedGuide.Specializations);
    }

    [Fact]
    public async Task GetById_WithoutAssignedGuide_ReturnsAssignedGuideNull()
    {
        var (travelerClient, bookingId, _) = await SetupBookingAsync(BookingStatus.Requested);

        var response = await travelerClient.GetAsync($"/api/bookings/{bookingId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var bookingDto = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.NotNull(bookingDto);
        Assert.Null(bookingDto.AssignedGuide);
    }

    [Fact]
    public async Task GetById_OtherTravelerBooking_CannotAccessGuideDetails()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.Confirmed);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var booking = await db.Bookings.FindAsync(bookingId);
            var guide = new Guide
            {
                Name = "Private Guide",
                Specializations = new[] { "Historical" },
                Languages = new[] { "English" },
                ContactInfo = "0779998888"
            };
            db.Guides.Add(guide);
            db.GuideAvailabilities.Add(new GuideAvailability
            {
                Guide = guide,
                Date = booking!.StartDate,
                IsAvailable = false,
                AssignedBookingId = bookingId
            });
            await db.SaveChangesAsync();
        }

        var otherTravelerClient = await AuthenticatedTravelerAsync();
        var response = await otherTravelerClient.GetAsync($"/api/bookings/{bookingId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetMine_IncludesAssignedGuideDetailsForTraveler()
    {
        var (travelerClient, bookingId, _) = await SetupBookingAsync(BookingStatus.Confirmed);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var booking = await db.Bookings.FindAsync(bookingId);
            var guide = new Guide
            {
                Name = "Tour Guide Kasun",
                Specializations = new[] { "Adventure" },
                Languages = new[] { "German", "English" },
                ContactInfo = "+94770001122"
            };
            db.Guides.Add(guide);
            db.GuideAvailabilities.Add(new GuideAvailability
            {
                Guide = guide,
                Date = booking!.StartDate,
                IsAvailable = false,
                AssignedBookingId = bookingId
            });
            await db.SaveChangesAsync();
        }

        var response = await travelerClient.GetAsync("/api/bookings/mine");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paged = await response.Content.ReadFromJsonAsync<PagedResult<BookingDto>>(JsonOptions);
        Assert.NotNull(paged);
        var found = paged.Items.FirstOrDefault(b => b.Id == bookingId);
        Assert.NotNull(found);
        Assert.NotNull(found.AssignedGuide);
        Assert.Equal("Tour Guide Kasun", found.AssignedGuide.Name);
        Assert.Equal("+94770001122", found.AssignedGuide.ContactInfo);
        Assert.Equal(new[] { "German", "English" }, found.AssignedGuide.Languages);
        Assert.Equal(new[] { "Adventure" }, found.AssignedGuide.Specializations);
    }

    [Fact]
    public async Task Complete_FromConfirmed_SetsCompleted()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.Confirmed);

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Completed", updated!.Status.ToString());
    }

    [Fact]
    public async Task Complete_FromNonConfirmedStatus_ReturnsConflict()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.Requested);

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Complete_WithTravelerToken_ReturnsForbidden()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.Confirmed);

        var travelerClient = await AuthenticatedTravelerAsync();
        var response = await travelerClient.PatchAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Cancel_AsOwner_UpcomingBooking_SetsCancelled()
    {
        var (client, bookingId, _) = await SetupBookingAsync(
            BookingStatus.Requested,
            startDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)));

        var response = await client.PatchAsJsonAsync($"/api/bookings/{bookingId}/cancel", new { Reason = "Change of plans" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Cancelled", updated!.Status.ToString());
    }

    [Fact]
    public async Task Cancel_AsOwner_PastBooking_ReturnsConflict()
    {
        var (client, bookingId, _) = await SetupBookingAsync(
            BookingStatus.Confirmed,
            startDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)));

        var response = await client.PatchAsJsonAsync($"/api/bookings/{bookingId}/cancel", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Cancel_AsNonOwnerTraveler_ReturnsForbidden()
    {
        var (_, bookingId, _) = await SetupBookingAsync(
            BookingStatus.Requested,
            startDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)));

        var otherTravelerClient = await AuthenticatedTravelerAsync();
        var response = await otherTravelerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/cancel", new { });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Cancel_AsManager_PastBooking_StillSucceeds()
    {
        var (_, bookingId, _) = await SetupBookingAsync(
            BookingStatus.Confirmed,
            startDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)));

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/cancel", new { Reason = "Operational issue" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Cancelled", updated!.Status.ToString());
    }

    [Fact]
    public async Task Cancel_OnCompletedBooking_ReturnsConflict()
    {
        var (_, bookingId, _) = await SetupBookingAsync(
            BookingStatus.Completed,
            startDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)));

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/cancel", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task GetMine_WithStatusPending_ReturnsAllPendingStatuses()
    {
        var (client, _, travelerId) = await SetupBookingAsync(BookingStatus.Requested);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var booking = await db.Bookings.FirstAsync(b => b.TravelerId == travelerId);
            
            // Add another booking with PlanProposed and another with Confirmed
            var p2 = new Booking
            {
                TravelerId = travelerId,
                TourPackageId = booking.TourPackageId,
                PackageTierId = booking.PackageTierId,
                GroupSize = 2,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(13)),
                BudgetPerPerson = 500m,
                Status = BookingStatus.PlanProposed
            };
            var p3 = new Booking
            {
                TravelerId = travelerId,
                TourPackageId = booking.TourPackageId,
                PackageTierId = booking.PackageTierId,
                GroupSize = 2,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(20)),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(23)),
                BudgetPerPerson = 500m,
                Status = BookingStatus.Confirmed
            };
            db.Bookings.AddRange(p2, p3);
            await db.SaveChangesAsync();
        }

        var response = await client.GetAsync("/api/bookings/mine?status=Pending");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var paged = await response.Content.ReadFromJsonAsync<PagedResult<BookingDto>>(JsonOptions);
        Assert.NotNull(paged);
        Assert.Equal(2, paged.TotalCount);
        Assert.All(paged.Items, b => Assert.Contains(b.Status, new[] { BookingStatus.Requested, BookingStatus.PlanProposed, BookingStatus.PendingApproval, BookingStatus.NeedsManualReview }));
    }

    private async Task<(HttpClient Client, Guid BookingId, Guid TravelerId)> SetupBookingAsync(
        BookingStatus status,
        DateOnly? startDate = null)
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var package = new TourPackage
        {
            Name = $"Lifecycle Test Tour {Guid.NewGuid():N}",
            Theme = "LifecycleTheme",
            DurationDays = 3,
            BasePricePerPerson = 200m,
            MaxGroupSize = 10
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = false,
            BasePricePerPerson = 200m,
            RequiresAC = false
        };
        var effectiveStartDate = startDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var booking = new Booking
        {
            TravelerId = travelerId,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = effectiveStartDate,
            EndDate = effectiveStartDate.AddDays(3),
            BudgetPerPerson = 500m,
            Status = status
        };

        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        return (client, booking.Id, travelerId);
    }

    private async Task<(HttpClient Client, Guid TravelerId)> AuthenticatedTravelerWithIdAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Traveler L", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<HttpClient> AuthenticatedTravelerAsync()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        return client;
    }

    private async Task<HttpClient> AuthenticatedOperationsManagerAsync()
    {
        var client = _factory.CreateClient();
        var adminLoginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var adminAuth = await adminLoginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        using var adminRequest = new HttpRequestMessage(HttpMethod.Post, "/api/auth/admin/users")
        {
            Headers = { Authorization = new AuthenticationHeaderValue("Bearer", adminAuth!.Token) },
            Content = JsonContent.Create(new
            {
                Name = "Ops Manager",
                Email = $"ops-{Guid.NewGuid():N}@example.com",
                Password = "P@ssword123",
                ContactNumber = "+14155550101",
                Role = "OperationsManager"
            })
        };
        var createResponse = await client.SendAsync(adminRequest);
        createResponse.EnsureSuccessStatusCode();
        var createdUser = await createResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = createdUser!.Email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
