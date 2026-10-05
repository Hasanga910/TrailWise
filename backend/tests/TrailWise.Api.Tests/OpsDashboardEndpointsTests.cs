using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Reports;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;
using static TrailWise.Api.Tests.ApiTestHelpers;

namespace TrailWise.Api.Tests;

/// <summary>GET /api/reports/dashboard. Each test uses its own database, so counts can be exact.</summary>
public class OpsDashboardEndpointsTests
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    [Fact]
    public async Task Dashboard_HasTheWindowAndGenerationTime()
    {
        using var factory = new TrailWiseWebApplicationFactory();

        var dashboard = await GetAsync(factory);

        Assert.InRange(dashboard.GeneratedAt, DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddMinutes(1));
        Assert.Equal(Today, dashboard.GuideUtilization.Window.From);
        Assert.Equal(Today.AddDays(29), dashboard.GuideUtilization.Window.To);
        Assert.Equal(30, dashboard.GuideUtilization.Window.Days);
        Assert.Equal(dashboard.GuideUtilization.Window, dashboard.VehicleUtilization.Window);
        Assert.Empty(dashboard.UpcomingTours);
        Assert.Equal(0, dashboard.Approvals.Counts.Total);
        Assert.Empty(dashboard.Approvals.RefundExceptions);
    }

    // ---------------------------------------------------------------- upcoming tours

    [Fact]
    public async Task UpcomingTours_AreConfirmedAndNotYetStarted_SoonestFirst_WithGuideAndVehicle()
    {
        using var factory = new TrailWiseWebApplicationFactory();
        var later = await SeedBookingAsync(factory, BookingStatus.Confirmed, Today.AddDays(20), withResources: true);
        var sooner = await SeedBookingAsync(factory, BookingStatus.Confirmed, Today.AddDays(3), withResources: true);
        var today = await SeedBookingAsync(factory, BookingStatus.Confirmed, Today, withResources: false);
        await SeedBookingAsync(factory, BookingStatus.Confirmed, Today.AddDays(-1), withResources: false); // already started
        await SeedBookingAsync(factory, BookingStatus.Cancelled, Today.AddDays(5), withResources: false);
        await SeedBookingAsync(factory, BookingStatus.Requested, Today.AddDays(6), withResources: false);
        await SeedBookingAsync(factory, BookingStatus.PendingApproval, Today.AddDays(7), withResources: false);

        var dashboard = await GetAsync(factory);

        Assert.Equal(new[] { today.BookingId, sooner.BookingId, later.BookingId }, dashboard.UpcomingTours.Select(t => t.BookingId));
        var tour = dashboard.UpcomingTours[1];
        Assert.Equal(3, tour.DaysUntilStart);
        Assert.Equal(sooner.PackageName, tour.TourPackageName);
        Assert.Equal(sooner.TravelerName, tour.TravelerName);
        Assert.Equal("Dashboard Guide", tour.GuideName);
        Assert.Equal(sooner.VehicleRegistration, tour.VehicleRegistration);
        Assert.Equal("Dashboard Driver", tour.DriverName);
        Assert.Equal(0, dashboard.UpcomingTours[0].DaysUntilStart);
        Assert.Null(dashboard.UpcomingTours[0].GuideName);
    }

    [Fact]
    public async Task UpcomingTours_AreLimitedToTheNextTen()
    {
        using var factory = new TrailWiseWebApplicationFactory();
        for (var i = 1; i <= 12; i++)
        {
            await SeedBookingAsync(factory, BookingStatus.Confirmed, Today.AddDays(i), withResources: false);
        }

        var dashboard = await GetAsync(factory);

        Assert.Equal(10, dashboard.UpcomingTours.Count);
        Assert.Equal(Enumerable.Range(1, 10), dashboard.UpcomingTours.Select(t => t.DaysUntilStart));
    }

    // ---------------------------------------------------------------- approvals

    [Fact]
    public async Task Approvals_CountPendingByType_AndIgnoreDecidedOnes()
    {
        using var factory = new TrailWiseWebApplicationFactory();
        await SeedApprovalAsync(factory, ApprovalType.LargeGroupOrCustomItinerary, daysUntilStart: 20);
        await SeedApprovalAsync(factory, ApprovalType.LargeGroupOrCustomItinerary, daysUntilStart: 21);
        await SeedApprovalAsync(factory, ApprovalType.BudgetOverride, daysUntilStart: 22);
        await SeedApprovalAsync(factory, ApprovalType.RefundException, daysUntilStart: 23);
        await SeedApprovalAsync(factory, ApprovalType.BudgetOverride, daysUntilStart: 24, status: ApprovalStatus.Approved);
        await SeedApprovalAsync(factory, ApprovalType.RefundException, daysUntilStart: 1, status: ApprovalStatus.Superseded);

        var approvals = (await GetAsync(factory)).Approvals;

        Assert.Equal(2, approvals.Counts.LargeGroupOrCustomItinerary);
        Assert.Equal(1, approvals.Counts.BudgetOverride);
        Assert.Equal(1, approvals.Counts.RefundException);
        Assert.Equal(4, approvals.Counts.Total);
        Assert.Single(approvals.RefundExceptions);
    }

    [Theory]
    [InlineData(-1, true)] // the tour has already started: most urgent of all
    [InlineData(0, true)]
    [InlineData(1, true)]
    [InlineData(2, true)]
    [InlineData(3, false)]
    [InlineData(10, false)]
    public async Task RefundExceptions_StartingWithinTwoDays_AreFlaggedUrgent(int daysUntilStart, bool urgent)
    {
        using var factory = new TrailWiseWebApplicationFactory();
        var seeded = await SeedApprovalAsync(factory, ApprovalType.RefundException, daysUntilStart);

        var approvals = (await GetAsync(factory)).Approvals;

        var item = Assert.Single(approvals.RefundExceptions);
        Assert.Equal(urgent, item.Urgent);
        Assert.Equal(daysUntilStart, item.DaysUntilStart);
        Assert.Equal(urgent ? 1 : 0, approvals.UrgentCount);
        Assert.Equal(2, approvals.UrgentWithinDays);
        // What the dashboard needs to link to the item in the approvals queue.
        Assert.Equal(seeded.ApprovalId, item.ApprovalId);
        Assert.Equal(seeded.BookingId, item.BookingId);
        Assert.Equal(Today.AddDays(daysUntilStart), item.StartDate);
        Assert.Equal(seeded.PackageName, item.TourPackageName);
        Assert.Equal(seeded.TravelerName, item.TravelerName);
    }

    [Fact]
    public async Task RefundExceptions_AreListedSoonestTourFirst_AndOnlyRefundExceptionsCanBeUrgent()
    {
        using var factory = new TrailWiseWebApplicationFactory();
        var far = await SeedApprovalAsync(factory, ApprovalType.RefundException, 5);
        var urgentOne = await SeedApprovalAsync(factory, ApprovalType.RefundException, 1);
        var urgentTwo = await SeedApprovalAsync(factory, ApprovalType.RefundException, 2);
        await SeedApprovalAsync(factory, ApprovalType.BudgetOverride, 1); // starts soon but is not a refund exception

        var approvals = (await GetAsync(factory)).Approvals;

        Assert.Equal(new[] { urgentOne.ApprovalId, urgentTwo.ApprovalId, far.ApprovalId }, approvals.RefundExceptions.Select(r => r.ApprovalId));
        Assert.Equal(2, approvals.UrgentCount);
        Assert.Equal(4, approvals.Counts.Total);
    }

    // ---------------------------------------------------------------- utilisation

    [Fact]
    public async Task GuideUtilization_UsesOnlyTheNext30Days_AndTheOverallIsAssignedOverRecorded()
    {
        using var factory = new TrailWiseWebApplicationFactory();
        Guid guideId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var guide = new Guide { Name = "Util Guide", Specializations = new[] { "x" }, Languages = new[] { "English" } };
            db.Guides.Add(guide);
            // 5 assigned days and 5 free days inside the window, plus rows outside it that must be ignored.
            for (var d = 0; d < 5; d++) db.GuideAvailabilities.Add(new GuideAvailability { Guide = guide, Date = Today.AddDays(d), IsAvailable = false, AssignedBookingId = null });
            for (var d = 5; d < 10; d++) db.GuideAvailabilities.Add(new GuideAvailability { Guide = guide, Date = Today.AddDays(d), IsAvailable = true });
            db.GuideAvailabilities.Add(new GuideAvailability { Guide = guide, Date = Today.AddDays(-3), IsAvailable = true });
            db.GuideAvailabilities.Add(new GuideAvailability { Guide = guide, Date = Today.AddDays(30), IsAvailable = true });
            await db.SaveChangesAsync();
            guideId = guide.Id;
        }

        // Make the first five days "assigned" to a real booking.
        await AssignGuideDaysAsync(factory, guideId, 5);

        var utilization = (await GetAsync(factory)).GuideUtilization;

        var mine = Assert.Single(utilization.Guides, g => g.GuideId == guideId);
        Assert.Equal((5, 5, 10, 50.0), (mine.AssignedDays, mine.AvailableDays, mine.RecordedDays, mine.UtilizationPercentage));
        var recorded = utilization.Guides.Sum(g => g.RecordedDays);
        var expectedOverall = recorded > 0 ? Math.Round((double)utilization.Guides.Sum(g => g.AssignedDays) / recorded * 100.0, 2) : 0.0;
        Assert.Equal(expectedOverall, utilization.OverallPercentage);
        Assert.True(utilization.OverallPercentage > 0);
    }

    [Fact]
    public async Task VehicleUtilization_CountsReservedDaysInTheWindow_ClipsAndSkipsCancelledBookings()
    {
        using var factory = new TrailWiseWebApplicationFactory();
        var tenDays = await SeedVehicleAsync(factory, "UTIL-A", VehicleMaintenanceStatus.Available,
            (BookingStatus.Confirmed, Today.AddDays(2), Today.AddDays(11)));
        var clipped = await SeedVehicleAsync(factory, "UTIL-B", VehicleMaintenanceStatus.Available,
            (BookingStatus.Confirmed, Today.AddDays(25), Today.AddDays(40)),   // 25..29 = 5 days inside
            (BookingStatus.Confirmed, Today.AddDays(-10), Today.AddDays(-5))); // entirely before the window
        var cancelledOnly = await SeedVehicleAsync(factory, "UTIL-C", VehicleMaintenanceStatus.Available,
            (BookingStatus.Cancelled, Today.AddDays(1), Today.AddDays(10)));
        var outOfService = await SeedVehicleAsync(factory, "UTIL-D", VehicleMaintenanceStatus.OutOfService);

        var utilization = (await GetAsync(factory)).VehicleUtilization;

        VehicleUtilizationItemDto Find(Guid id) => Assert.Single(utilization.Vehicles, v => v.VehicleId == id);
        Assert.Equal((10, 33.33), (Find(tenDays).BookedDays, Find(tenDays).UtilizationPercentage));
        Assert.Equal((5, 16.67), (Find(clipped).BookedDays, Find(clipped).UtilizationPercentage));
        Assert.Equal(0, Find(cancelledOnly).BookedDays);
        Assert.Equal(VehicleMaintenanceStatus.OutOfService, Find(outOfService).MaintenanceStatus);

        // The overall figure only counts vehicles that are in service.
        var inService = utilization.Vehicles.Where(v => v.MaintenanceStatus != VehicleMaintenanceStatus.OutOfService).ToList();
        Assert.Equal(inService.Count, utilization.InServiceVehicles);
        Assert.DoesNotContain(inService, v => v.VehicleId == outOfService);
        Assert.Equal(
            Math.Round((double)inService.Sum(v => v.BookedDays) / (inService.Count * 30) * 100.0, 2),
            utilization.OverallPercentage);
    }

    // ---------------------------------------------------------------- workflows

    [Fact]
    public async Task Workflows_CountRunsByStatus_AndBookingsNeedingManualReview()
    {
        using var factory = new TrailWiseWebApplicationFactory();
        var booking = await SeedBookingAsync(factory, BookingStatus.NeedsManualReview, Today.AddDays(9), withResources: false);
        await SeedBookingAsync(factory, BookingStatus.NeedsManualReview, Today.AddDays(9), withResources: false);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            foreach (var status in new[] { "Running", "Running", "AwaitingApproval", "Failed", "Failed", "Failed", "Completed" })
            {
                db.AgentWorkflowRuns.Add(new AgentWorkflowRun { BookingId = booking.BookingId, Objective = "o", Status = status });
            }
            await db.SaveChangesAsync();
        }

        var workflows = (await GetAsync(factory)).Workflows;

        Assert.Equal((2, 1, 3, 2), (workflows.Running, workflows.AwaitingApproval, workflows.Failed, workflows.BookingsNeedingManualReview));
    }

    // ---------------------------------------------------------------- roles

    [Theory]
    [InlineData("OperationsManager", HttpStatusCode.OK)]
    [InlineData("Admin", HttpStatusCode.OK)]
    [InlineData("FleetCoordinator", HttpStatusCode.Forbidden)]
    [InlineData("TourGuide", HttpStatusCode.Forbidden)]
    [InlineData("Traveler", HttpStatusCode.Forbidden)]
    public async Task Dashboard_IsForOperationsManagerAndAdminOnly(string role, HttpStatusCode expected)
    {
        using var factory = new TrailWiseWebApplicationFactory();
        var client = await ClientForRoleAsync(factory, role);

        Assert.Equal(expected, (await client.GetAsync("/api/reports/dashboard")).StatusCode);
    }

    [Fact]
    public async Task Dashboard_RequiresAuthentication()
    {
        using var factory = new TrailWiseWebApplicationFactory();

        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/reports/dashboard")).StatusCode);
    }

    // ---------------------------------------------------------------- helpers

    private static async Task<OpsDashboardDto> GetAsync(TrailWiseWebApplicationFactory factory)
    {
        var client = await ClientForRoleAsync(factory, "OperationsManager");
        return (await client.GetFromJsonAsync<OpsDashboardDto>("/api/reports/dashboard", JsonOptions))!;
    }

    private sealed record SeededBooking(Guid BookingId, string PackageName, string TravelerName, string? VehicleRegistration);

    private sealed record SeededApproval(Guid ApprovalId, Guid BookingId, string PackageName, string TravelerName);

    private static async Task<SeededBooking> SeedBookingAsync(
        TrailWiseWebApplicationFactory factory, BookingStatus status, DateOnly start, bool withResources)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var name = $"Dash Traveler {Guid.NewGuid():N}"[..22];
        var traveler = new User { Name = name, Email = $"dash-{Guid.NewGuid():N}@example.com", ContactNumber = "+14155550100", PasswordHash = "x", Role = UserRole.Traveler };
        var packageName = $"Dash Package {Guid.NewGuid():N}"[..22];
        var package = new TourPackage { Name = packageName, Theme = "T", DurationDays = 3, BasePricePerPerson = 100m, MaxGroupSize = 20 };
        var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, BasePricePerPerson = 100m };
        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = start,
            EndDate = start.AddDays(3),
            BudgetPerPerson = 200m,
            Status = status
        };
        db.AddRange(traveler, package, tier, booking);

        string? registration = null;
        if (withResources)
        {
            var guide = new Guide { Name = "Dashboard Guide", Specializations = new[] { "T" }, Languages = new[] { "English" } };
            registration = $"DASH-{Guid.NewGuid():N}"[..10];
            var vehicle = new Vehicle { Type = VehicleType.Van, RegistrationNumber = registration, Capacity = 8, HasAC = true, SeatConfiguration = "2-2", MaintenanceStatus = VehicleMaintenanceStatus.Available };
            var driver = new Driver { Name = "Dashboard Driver", LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10], ContactInfo = "+94770000012" };
            db.AddRange(guide, vehicle, driver);
            db.GuideAvailabilities.Add(new GuideAvailability { Guide = guide, Date = start, IsAvailable = false, AssignedBookingId = booking.Id });
            db.VehicleAssignments.Add(new VehicleAssignment { Vehicle = vehicle, Driver = driver, Booking = booking, StartDate = start, EndDate = booking.EndDate });
        }

        await db.SaveChangesAsync();
        return new SeededBooking(booking.Id, packageName, name, registration);
    }

    private static async Task<SeededApproval> SeedApprovalAsync(
        TrailWiseWebApplicationFactory factory, ApprovalType type, int daysUntilStart, ApprovalStatus status = ApprovalStatus.Pending)
    {
        var booking = await SeedBookingAsync(factory, BookingStatus.PendingApproval, Today.AddDays(daysUntilStart), withResources: false);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var approval = new ApprovalRequest { BookingId = booking.BookingId, Type = type, Status = status, RequestedAt = DateTimeOffset.UtcNow };
        db.ApprovalRequests.Add(approval);
        await db.SaveChangesAsync();
        return new SeededApproval(approval.Id, booking.BookingId, booking.PackageName, booking.TravelerName);
    }

    private static async Task AssignGuideDaysAsync(TrailWiseWebApplicationFactory factory, Guid guideId, int days)
    {
        var booking = await SeedBookingAsync(factory, BookingStatus.Confirmed, Today.AddDays(40), withResources: false);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var rows = await db.GuideAvailabilities
            .Where(a => a.GuideId == guideId && a.Date >= Today && a.Date < Today.AddDays(days))
            .ToListAsync();
        foreach (var row in rows)
        {
            row.AssignedBookingId = booking.BookingId;
        }

        await db.SaveChangesAsync();
    }

    private static async Task<Guid> SeedVehicleAsync(
        TrailWiseWebApplicationFactory factory,
        string registration,
        VehicleMaintenanceStatus maintenance,
        params (BookingStatus Status, DateOnly Start, DateOnly End)[] assignments)
    {
        Guid vehicleId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var vehicle = new Vehicle { Type = VehicleType.Van, RegistrationNumber = registration, Capacity = 8, HasAC = true, SeatConfiguration = "2-2", MaintenanceStatus = maintenance };
            db.Vehicles.Add(vehicle);
            await db.SaveChangesAsync();
            vehicleId = vehicle.Id;
        }

        foreach (var (status, start, end) in assignments)
        {
            var booking = await SeedBookingAsync(factory, status, start, withResources: false);
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var driver = new Driver { Name = "Util Driver", LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10], ContactInfo = "+94770000013" };
            db.Drivers.Add(driver);
            db.VehicleAssignments.Add(new VehicleAssignment { VehicleId = vehicleId, Driver = driver, BookingId = booking.BookingId, StartDate = start, EndDate = end });
            await db.SaveChangesAsync();
        }

        return vehicleId;
    }
}
