using Microsoft.Extensions.Logging.Abstractions;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class CoordinatorAgentServiceTests
{
    private static CoordinatorAgentService CreateSut(TrailWiseDbContext db) =>
        new(
            db,
            new MockGuideMatchingAgent(),
            new MockFleetCapacityAgent(),
            new MockPricingValidationAgent(db),
            NullLogger<CoordinatorAgentService>.Instance);

    private static Guid SeedBooking(
        TrailWiseDbContext db,
        int groupSize,
        decimal budgetPerPerson,
        decimal basePricePerPerson,
        bool includesFood = false,
        bool requiresAc = false,
        int maxGroupSize = 50)
    {
        var traveler = new User
        {
            Name = "Test Traveler",
            Email = $"traveler-{Guid.NewGuid():N}@example.com",
            ContactNumber = "+14155550100",
            PasswordHash = "irrelevant",
            Role = UserRole.Traveler
        };

        var package = new TourPackage
        {
            Name = "Test Package",
            Theme = "Testing",
            DurationDays = 3,
            BasePricePerPerson = basePricePerPerson,
            MaxGroupSize = maxGroupSize
        };

        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = includesFood,
            BasePricePerPerson = basePricePerPerson,
            RequiresAC = requiresAc
        };

        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = groupSize,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(33)),
            BudgetPerPerson = budgetPerPerson,
            Status = BookingStatus.Requested
        };

        db.Users.Add(traveler);
        db.TourPackages.Add(package);
        db.PackageTiers.Add(tier);
        db.Bookings.Add(booking);
        db.SaveChanges();

        return booking.Id;
    }

    [Fact]
    public async Task StartWorkflowAsync_SmallGroupWithinBudget_ResultsInConfirmed()
    {
        var db = TestDbContextFactory.Create();
        // mock price = 100 * 2 = 200; budget ceiling = 150 * 2 * 1.15 = 345
        var bookingId = SeedBooking(db, groupSize: 2, budgetPerPerson: 150m, basePricePerPerson: 100m);

        var sut = CreateSut(db);
        await sut.StartWorkflowAsync(bookingId);

        var booking = await db.Bookings.FindAsync(bookingId);
        Assert.Equal(BookingStatus.Confirmed, booking!.Status);

        var run = Assert.Single(db.AgentWorkflowRuns, r => r.BookingId == bookingId);
        Assert.Equal("Completed", run.Status);
        Assert.NotNull(run.CompletedAt);

        var stepLogs = db.AgentStepLogs.Where(s => s.WorkflowRunId == run.Id).ToList();
        Assert.Equal(4, stepLogs.Count);

        Assert.Contains("\"status\":\"done\"", run.PlanJson);
        Assert.DoesNotContain("\"status\":\"pending\"", run.PlanJson);
    }

    [Fact]
    public async Task StartWorkflowAsync_LargeGroup_ResultsInPendingApproval()
    {
        var db = TestDbContextFactory.Create();
        // groupSize 11 > threshold 10; keep cost comfortably within budget so only the
        // group-size rule fires (mock price = 100 * 11 = 1100; ceiling = 500*11*1.15 = 6325).
        var bookingId = SeedBooking(db, groupSize: 11, budgetPerPerson: 500m, basePricePerPerson: 100m, maxGroupSize: 50);

        var sut = CreateSut(db);
        await sut.StartWorkflowAsync(bookingId);

        var booking = await db.Bookings.FindAsync(bookingId);
        Assert.Equal(BookingStatus.PendingApproval, booking!.Status);

        var run = Assert.Single(db.AgentWorkflowRuns, r => r.BookingId == bookingId);
        Assert.Equal("AwaitingApproval", run.Status);
        Assert.Null(run.CompletedAt);
    }

    [Fact]
    public async Task StartWorkflowAsync_OverBudget_ResultsInPendingApproval()
    {
        var db = TestDbContextFactory.Create();
        // groupSize 2 (<=10, so group-size rule doesn't fire); mock price = 300*2 = 600;
        // ceiling = 100*2*1.15 = 230, so cost exceeds ceiling.
        var bookingId = SeedBooking(db, groupSize: 2, budgetPerPerson: 100m, basePricePerPerson: 300m);

        var sut = CreateSut(db);
        await sut.StartWorkflowAsync(bookingId);

        var booking = await db.Bookings.FindAsync(bookingId);
        Assert.Equal(BookingStatus.PendingApproval, booking!.Status);

        var run = Assert.Single(db.AgentWorkflowRuns, r => r.BookingId == bookingId);
        Assert.Equal("AwaitingApproval", run.Status);
    }

    [Fact]
    public async Task StartWorkflowAsync_MissingBooking_ReturnsWithoutThrowingOrCreatingRun()
    {
        var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        await sut.StartWorkflowAsync(Guid.NewGuid());

        Assert.Empty(db.AgentWorkflowRuns);
    }
}
