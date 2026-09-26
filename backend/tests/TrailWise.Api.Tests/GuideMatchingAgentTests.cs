using Microsoft.Extensions.Logging.Abstractions;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class GuideMatchingAgentTests
{
    private static GuideMatchingAgent CreateSut(
        TrailWiseDbContext db,
        IGuideAvailabilityService? availabilityService = null)
    {
        var svc = availabilityService ?? new GuideAvailabilityService(
            db,
            NullLogger<GuideAvailabilityService>.Instance);

        return new GuideMatchingAgent(
            db,
            svc,
            NullLogger<GuideMatchingAgent>.Instance);
    }

    private static (TourPackage Package, Booking Booking) SeedBooking(
        TrailWiseDbContext db,
        string theme = "Cultural",
        DateOnly? startDate = null,
        DateOnly? endDate = null)
    {
        var start = startDate ?? new DateOnly(2026, 10, 10);
        var end = endDate ?? new DateOnly(2026, 10, 15);

        var traveler = new User
        {
            Name = "Test Traveler",
            Email = $"traveler-{Guid.NewGuid():N}@example.com",
            ContactNumber = "+1234567890",
            PasswordHash = "hashed",
            Role = UserRole.Traveler
        };
        db.Users.Add(traveler);

        var package = new TourPackage
        {
            Name = "Test Package",
            Theme = theme,
            DurationDays = 6,
            BasePricePerPerson = 120m,
            MaxGroupSize = 15
        };
        db.TourPackages.Add(package);

        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = true,
            BasePricePerPerson = 120m,
            RequiresAC = false
        };
        db.PackageTiers.Add(tier);

        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = start,
            EndDate = end,
            BudgetPerPerson = 200m,
            Status = BookingStatus.Requested
        };
        db.Bookings.Add(booking);
        db.SaveChanges();

        return (package, booking);
    }

    private static Guide SeedGuide(
        TrailWiseDbContext db,
        string name = "Janindu",
        string[]? specializations = null,
        Guid? id = null)
    {
        var guide = new Guide
        {
            Id = id ?? Guid.NewGuid(),
            Name = name,
            Specializations = specializations ?? new[] { "Cultural" },
            Languages = new[] { "English", "Sinhala" },
            ContactInfo = "contact@example.com"
        };
        db.Guides.Add(guide);
        db.SaveChanges();
        return guide;
    }

    // 1. One matching available guide is selected
    [Fact]
    public async Task MatchAsync_OneMatchingAvailableGuide_IsSelected()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural");
        var guide = SeedGuide(db, name: "Janindu", specializations: new[] { "Cultural" });

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(guide.Id, result.GuideId);
        Assert.True(result.MatchScore >= 0.7);
        Assert.Contains("Janindu", result.Reasoning);
        Assert.Contains("Cultural", result.Reasoning);
    }

    // 2. Specialization matching is case-insensitive and trims whitespace
    [Fact]
    public async Task MatchAsync_SpecializationMatch_IsCaseInsensitiveAndTrimmed()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "  cUlTuRaL  ");
        var guide = SeedGuide(db, name: "Janindu", specializations: new[] { " cultural " });

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(guide.Id, result.GuideId);
        Assert.True(result.MatchScore >= 0.7);
    }

    // 3. Wrong specialization is excluded
    [Fact]
    public async Task MatchAsync_WrongSpecialization_IsExcluded()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Wildlife");
        SeedGuide(db, name: "Janindu", specializations: new[] { "Beach", "Adventure" });

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(Guid.Empty, result.GuideId);
        Assert.Equal(0, result.MatchScore);
        Assert.Contains("Wildlife", result.Reasoning);
    }

    // 4. Guide unavailable during booking dates is excluded
    [Fact]
    public async Task MatchAsync_GuideUnavailableDuringBookingDates_IsExcluded()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural",
            startDate: new DateOnly(2026, 10, 10),
            endDate: new DateOnly(2026, 10, 15));
        var guide = SeedGuide(db, name: "Janindu", specializations: new[] { "Cultural" });

        // Add unavailable day inside booking range
        db.GuideAvailabilities.Add(new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 12),
            IsAvailable = false
        });
        await db.SaveChangesAsync();

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(Guid.Empty, result.GuideId);
        Assert.Equal(0, result.MatchScore);
        Assert.Contains("No guide with Cultural specialization is available", result.Reasoning);
    }

    // 5. AssignedBookingId conflict excludes guide
    [Fact]
    public async Task MatchAsync_GuideWithAssignedBookingConflict_IsExcluded()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural",
            startDate: new DateOnly(2026, 10, 10),
            endDate: new DateOnly(2026, 10, 15));
        var guide = SeedGuide(db, name: "Janindu", specializations: new[] { "Cultural" });

        // Add conflicting booking assignment
        db.GuideAvailabilities.Add(new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 11),
            IsAvailable = true,
            AssignedBookingId = Guid.NewGuid()
        });
        await db.SaveChangesAsync();

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(Guid.Empty, result.GuideId);
        Assert.Equal(0, result.MatchScore);
    }

    // 6. Candidate with both free buffer days scores 1.0
    [Fact]
    public async Task MatchAsync_CandidateWithBothFreeBufferDays_ScoresOnePointZero()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural",
            startDate: new DateOnly(2026, 10, 10),
            endDate: new DateOnly(2026, 10, 15));
        var guide = SeedGuide(db, name: "Janindu", specializations: new[] { "Cultural" });

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(guide.Id, result.GuideId);
        Assert.Equal(1.0, result.MatchScore);
        Assert.Contains("with free buffer days", result.Reasoning);
        Assert.Contains("Language matching was not evaluated", result.Reasoning);
    }

    // 7. Valid guide without complete buffer scores 0.7
    [Fact]
    public async Task MatchAsync_CandidateWithoutCompleteBuffer_ScoresZeroPointSeven()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural",
            startDate: new DateOnly(2026, 10, 10),
            endDate: new DateOnly(2026, 10, 15));
        var guide = SeedGuide(db, name: "Janindu", specializations: new[] { "Cultural" });

        // Block buffer day immediately before booking (2026-10-09)
        db.GuideAvailabilities.Add(new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 9),
            IsAvailable = false
        });
        await db.SaveChangesAsync();

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(guide.Id, result.GuideId);
        Assert.Equal(0.7, result.MatchScore);
        Assert.Contains("without free buffer days", result.Reasoning);
    }

    // 8. Higher-scoring guide is selected
    [Fact]
    public async Task MatchAsync_HigherScoringGuide_IsSelectedOverLowerScoring()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural",
            startDate: new DateOnly(2026, 10, 10),
            endDate: new DateOnly(2026, 10, 15));

        // Alice is alphabetically first, but her buffer day is blocked (score 0.7)
        var alice = SeedGuide(db, name: "Alice", specializations: new[] { "Cultural" });
        db.GuideAvailabilities.Add(new GuideAvailability
        {
            GuideId = alice.Id,
            Date = new DateOnly(2026, 10, 9),
            IsAvailable = false
        });

        // Bob has both buffer days free (score 1.0)
        var bob = SeedGuide(db, name: "Bob", specializations: new[] { "Cultural" });
        await db.SaveChangesAsync();

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(bob.Id, result.GuideId);
        Assert.Equal(1.0, result.MatchScore);
    }

    // 9. Equal-score candidates use deterministic name/ID tie-breaker
    [Fact]
    public async Task MatchAsync_EqualScoreCandidates_UseDeterministicTieBreaker()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural");

        // Both Bob and Alice have identical score (1.0)
        SeedGuide(db, name: "Bob", specializations: new[] { "Cultural" });
        var alice = SeedGuide(db, name: "Alice", specializations: new[] { "Cultural" });

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        // "Alice" comes before "Bob" alphabetically
        Assert.Equal(alice.Id, result.GuideId);
        Assert.Equal(1.0, result.MatchScore);
    }

    [Fact]
    public async Task MatchAsync_SameNameAndScore_UsesGuidTieBreaker()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural");

        var idSmaller = new Guid("11111111-1111-1111-1111-111111111111");
        var idLarger = new Guid("22222222-2222-2222-2222-222222222222");

        // Same name "Sam", same score 1.0
        SeedGuide(db, name: "Sam", specializations: new[] { "Cultural" }, id: idLarger);
        SeedGuide(db, name: "Sam", specializations: new[] { "Cultural" }, id: idSmaller);

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(idSmaller, result.GuideId);
    }

    // 10. No qualifying guide returns Guid.Empty and score 0
    [Fact]
    public async Task MatchAsync_NoGuidesInDatabase_ReturnsEmptyResult()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural");

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(Guid.Empty, result.GuideId);
        Assert.Equal(0, result.MatchScore);
        Assert.Contains("No guide with Cultural specialization is available", result.Reasoning);
    }

    // 11. Nonexistent booking returns graceful failure
    [Fact]
    public async Task MatchAsync_NonexistentBooking_ReturnsGracefulFailure()
    {
        var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.MatchAsync(Guid.NewGuid());

        Assert.Equal(Guid.Empty, result.GuideId);
        Assert.Equal(0, result.MatchScore);
        Assert.Equal("Booking not found.", result.Reasoning);
    }

    // 12. Valid match score remains > 0.5 (Coordinator threshold)
    [Fact]
    public async Task MatchAsync_ValidMatchScores_RemainAboveCoordinatorThreshold()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural",
            startDate: new DateOnly(2026, 10, 10),
            endDate: new DateOnly(2026, 10, 15));
        var guide = SeedGuide(db, name: "Janindu", specializations: new[] { "Cultural" });

        var sut = CreateSut(db);
        var resultFullBuffer = await sut.MatchAsync(booking.Id);

        Assert.True(resultFullBuffer.MatchScore > BookingApprovalEvaluator.MinAcceptableGuideMatchScore);

        // Test without buffer
        db.GuideAvailabilities.Add(new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 9),
            IsAvailable = false
        });
        await db.SaveChangesAsync();

        var resultNoBuffer = await sut.MatchAsync(booking.Id);
        Assert.True(resultNoBuffer.MatchScore > BookingApprovalEvaluator.MinAcceptableGuideMatchScore);
    }

    // 13 & 14. MatchAsync does NOT alter GuideAvailability or write AssignedBookingId
    [Fact]
    public async Task MatchAsync_PerformsNoDatabaseWrites_DoesNotAlterGuideAvailability()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural");
        var guide = SeedGuide(db, name: "Janindu", specializations: new[] { "Cultural" });

        var existingAvailability = new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 1),
            IsAvailable = true,
            AssignedBookingId = null
        };
        db.GuideAvailabilities.Add(existingAvailability);
        await db.SaveChangesAsync();

        var beforeCount = db.GuideAvailabilities.Count();

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(guide.Id, result.GuideId);

        var afterCount = db.GuideAvailabilities.Count();
        Assert.Equal(beforeCount, afterCount);

        var availabilityRow = db.GuideAvailabilities.Single();
        Assert.Null(availabilityRow.AssignedBookingId);
        Assert.True(availabilityRow.IsAvailable);
    }

    // 15. Unexpected failure is handled gracefully without throwing
    [Fact]
    public async Task MatchAsync_UnexpectedFailure_ReturnsGracefulFailureResult()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural");
        SeedGuide(db, name: "Janindu", specializations: new[] { "Cultural" });

        var throwingService = new ThrowingGuideAvailabilityService();
        var sut = CreateSut(db, throwingService);

        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(Guid.Empty, result.GuideId);
        Assert.Equal(0, result.MatchScore);
        Assert.Equal("Guide matching could not be completed.", result.Reasoning);
    }

    // Edge case: booking tour package missing theme
    [Fact]
    public async Task MatchAsync_TourPackageWithoutTheme_ReturnsGracefulFailure()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "");
        SeedGuide(db, name: "Janindu", specializations: new[] { "Cultural" });

        var sut = CreateSut(db);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(Guid.Empty, result.GuideId);
        Assert.Equal(0, result.MatchScore);
        Assert.Contains("Tour package does not specify a theme", result.Reasoning);
    }

    private class ThrowingGuideAvailabilityService : IGuideAvailabilityService
    {
        public Task<bool> IsGuideAvailableAsync(
            Guid guideId,
            DateOnly startDate,
            DateOnly endDate,
            CancellationToken ct = default)
        {
            throw new InvalidOperationException("Simulated unexpected database failure.");
        }
    }
}
