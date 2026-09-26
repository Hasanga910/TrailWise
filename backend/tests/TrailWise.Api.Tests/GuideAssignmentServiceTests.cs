using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class GuideAssignmentServiceTests
{
    private static GuideAssignmentService CreateSut(TrailWiseDbContext db) =>
        new(db, NullLogger<GuideAssignmentService>.Instance);

    private static (TourPackage Package, Booking Booking) SeedBooking(
        TrailWiseDbContext db,
        DateOnly? startDate = null,
        DateOnly? endDate = null,
        string theme = "Cultural")
    {
        var start = startDate ?? new DateOnly(2026, 10, 10);
        var end = endDate ?? new DateOnly(2026, 10, 13);

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
            DurationDays = (end.DayNumber - start.DayNumber) + 1,
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
            Status = BookingStatus.Confirmed
        };
        db.Bookings.Add(booking);
        db.SaveChanges();

        return (package, booking);
    }

    private static Guide SeedGuide(
        TrailWiseDbContext db,
        string name = "Janindu",
        string[]? specializations = null)
    {
        var guide = new Guide
        {
            Id = Guid.NewGuid(),
            Name = name,
            Specializations = specializations ?? new[] { "Cultural" },
            Languages = new[] { "English", "Sinhala" },
            ContactInfo = "contact@example.com"
        };
        db.Guides.Add(guide);
        db.SaveChanges();
        return guide;
    }

    // 1. AssignGuideAsync creates rows for every booking date
    // 2. Assigned rows contain correct GuideId, correct AssignedBookingId, IsAvailable = false
    // 12. Full inclusive date range is assigned correctly
    [Fact]
    public async Task AssignGuideAsync_ValidBookingAndGuide_CreatesRowsForEveryDateWithCorrectProperties()
    {
        var db = TestDbContextFactory.Create();
        var start = new DateOnly(2026, 10, 10);
        var end = new DateOnly(2026, 10, 13); // 4 days inclusive (10, 11, 12, 13)
        var (_, booking) = SeedBooking(db, startDate: start, endDate: end);
        var guide = SeedGuide(db, "Janindu");

        var sut = CreateSut(db);
        var result = await sut.AssignGuideAsync(booking.Id, guide.Id);

        Assert.True(result);

        var rows = db.GuideAvailabilities
            .Where(a => a.GuideId == guide.Id)
            .OrderBy(a => a.Date)
            .ToList();

        Assert.Equal(4, rows.Count);
        var expectedDates = new[]
        {
            new DateOnly(2026, 10, 10),
            new DateOnly(2026, 10, 11),
            new DateOnly(2026, 10, 12),
            new DateOnly(2026, 10, 13),
        };

        for (var i = 0; i < 4; i++)
        {
            Assert.Equal(expectedDates[i], rows[i].Date);
            Assert.Equal(guide.Id, rows[i].GuideId);
            Assert.Equal(booking.Id, rows[i].AssignedBookingId);
            Assert.False(rows[i].IsAvailable);
        }
    }

    // 3. Existing compatible availability rows are updated instead of duplicated
    [Fact]
    public async Task AssignGuideAsync_ExistingCompatibleRow_IsUpdatedWithoutDuplication()
    {
        var db = TestDbContextFactory.Create();
        var start = new DateOnly(2026, 10, 10);
        var end = new DateOnly(2026, 10, 12); // 3 days (10, 11, 12)
        var (_, booking) = SeedBooking(db, startDate: start, endDate: end);
        var guide = SeedGuide(db, "Janindu");

        // Existing compatible row for 2026-10-11 (explicitly marked available, unassigned)
        var existingRow = new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 11),
            IsAvailable = true,
            AssignedBookingId = null
        };
        db.GuideAvailabilities.Add(existingRow);
        await db.SaveChangesAsync();

        var sut = CreateSut(db);
        var result = await sut.AssignGuideAsync(booking.Id, guide.Id);

        Assert.True(result);

        var rows = db.GuideAvailabilities
            .Where(a => a.GuideId == guide.Id)
            .OrderBy(a => a.Date)
            .ToList();

        // Must still have exactly 3 rows (no duplicate on 10-11)
        Assert.Equal(3, rows.Count);

        var middleRow = rows.Single(r => r.Date == new DateOnly(2026, 10, 11));
        Assert.Equal(existingRow.Id, middleRow.Id); // Same existing row updated
        Assert.Equal(booking.Id, middleRow.AssignedBookingId);
        Assert.False(middleRow.IsAvailable);
    }

    // 4. Existing manual unavailable/conflicting date causes assignment to fail
    // 6. Failure leaves no partial assignment rows
    [Fact]
    public async Task AssignGuideAsync_ExistingManualUnavailableDate_FailsAndLeavesNoPartialRows()
    {
        var db = TestDbContextFactory.Create();
        var start = new DateOnly(2026, 10, 10);
        var end = new DateOnly(2026, 10, 15); // 6 days
        var (_, booking) = SeedBooking(db, startDate: start, endDate: end);
        var guide = SeedGuide(db, "Janindu");

        // Guide has a manual day-off on 2026-10-13 (IsAvailable = false, AssignedBookingId = null)
        var dayOffRow = new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 13),
            IsAvailable = false,
            AssignedBookingId = null
        };
        db.GuideAvailabilities.Add(dayOffRow);
        await db.SaveChangesAsync();

        var sut = CreateSut(db);
        var result = await sut.AssignGuideAsync(booking.Id, guide.Id);

        Assert.False(result);

        // Crucial: No partial rows must have been created for 10, 11, 12, 14, 15
        var totalRows = db.GuideAvailabilities.Where(a => a.GuideId == guide.Id).ToList();
        Assert.Single(totalRows);
        Assert.Equal(dayOffRow.Id, totalRows[0].Id);
        Assert.Null(totalRows[0].AssignedBookingId);
    }

    // 5. Existing assignment to another booking causes assignment to fail
    // 6. Failure leaves no partial assignment rows
    [Fact]
    public async Task AssignGuideAsync_ExistingAssignmentToAnotherBooking_FailsAndLeavesNoPartialRows()
    {
        var db = TestDbContextFactory.Create();
        var start = new DateOnly(2026, 10, 10);
        var end = new DateOnly(2026, 10, 15);
        var (_, booking1) = SeedBooking(db, startDate: start, endDate: end);
        var (_, booking2) = SeedBooking(db, startDate: new DateOnly(2026, 10, 12), endDate: new DateOnly(2026, 10, 18));
        var guide = SeedGuide(db, "Janindu");

        var sut = CreateSut(db);

        // Assign booking 1 first
        var res1 = await sut.AssignGuideAsync(booking1.Id, guide.Id);
        Assert.True(res1);

        var rowsAfterBooking1 = db.GuideAvailabilities.Count(a => a.GuideId == guide.Id);
        Assert.Equal(6, rowsAfterBooking1);

        // Attempt to assign booking 2 (overlaps Oct 12 - Oct 15)
        var res2 = await sut.AssignGuideAsync(booking2.Id, guide.Id);
        Assert.False(res2);

        // Booking 2 must have created zero rows (e.g. for Oct 16, 17, 18)
        var rowsAfterBooking2 = db.GuideAvailabilities.Count(a => a.GuideId == guide.Id);
        Assert.Equal(6, rowsAfterBooking2);

        // All existing rows must still belong to booking 1
        Assert.All(db.GuideAvailabilities.Where(a => a.GuideId == guide.Id),
            r => Assert.Equal(booking1.Id, r.AssignedBookingId));
    }

    // 7. Same booking + same guide can be assigned twice safely (idempotent)
    [Fact]
    public async Task AssignGuideAsync_SameBookingSameGuideTwice_SucceedsIdempotently()
    {
        var db = TestDbContextFactory.Create();
        var start = new DateOnly(2026, 10, 10);
        var end = new DateOnly(2026, 10, 12);
        var (_, booking) = SeedBooking(db, startDate: start, endDate: end);
        var guide = SeedGuide(db, "Janindu");

        var sut = CreateSut(db);

        var firstCall = await sut.AssignGuideAsync(booking.Id, guide.Id);
        Assert.True(firstCall);

        var countAfterFirst = db.GuideAvailabilities.Count(a => a.GuideId == guide.Id);
        Assert.Equal(3, countAfterFirst);

        // Second call with identical arguments
        var secondCall = await sut.AssignGuideAsync(booking.Id, guide.Id);
        Assert.True(secondCall);

        var countAfterSecond = db.GuideAvailabilities.Count(a => a.GuideId == guide.Id);
        Assert.Equal(3, countAfterSecond); // Still 3, no duplicates
    }

    // 8. Another booking with overlapping dates cannot assign same guide
    [Fact]
    public async Task AssignGuideAsync_OverlappingDates_RejectsSecondBooking()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking1) = SeedBooking(db,
            startDate: new DateOnly(2026, 10, 10),
            endDate: new DateOnly(2026, 10, 14));
        var (_, booking2) = SeedBooking(db,
            startDate: new DateOnly(2026, 10, 14), // 1-day overlap on Oct 14
            endDate: new DateOnly(2026, 10, 18));
        var guide = SeedGuide(db, "Janindu");

        var sut = CreateSut(db);

        Assert.True(await sut.AssignGuideAsync(booking1.Id, guide.Id));
        Assert.False(await sut.AssignGuideAsync(booking2.Id, guide.Id));
    }

    // 9. Non-overlapping booking can assign same guide
    [Fact]
    public async Task AssignGuideAsync_NonOverlappingBookings_BothSucceed()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking1) = SeedBooking(db,
            startDate: new DateOnly(2026, 10, 10),
            endDate: new DateOnly(2026, 10, 12));
        var (_, booking2) = SeedBooking(db,
            startDate: new DateOnly(2026, 10, 15),
            endDate: new DateOnly(2026, 10, 18));
        var guide = SeedGuide(db, "Janindu");

        var sut = CreateSut(db);

        Assert.True(await sut.AssignGuideAsync(booking1.Id, guide.Id));
        Assert.True(await sut.AssignGuideAsync(booking2.Id, guide.Id));

        var rows = db.GuideAvailabilities.Where(a => a.GuideId == guide.Id).ToList();
        Assert.Equal(7, rows.Count); // 3 days for booking1 + 4 days for booking2
    }

    // 10. Nonexistent booking returns failure cleanly
    [Fact]
    public async Task AssignGuideAsync_NonexistentBooking_ReturnsFalse()
    {
        var db = TestDbContextFactory.Create();
        var guide = SeedGuide(db, "Janindu");

        var sut = CreateSut(db);
        var result = await sut.AssignGuideAsync(Guid.NewGuid(), guide.Id);

        Assert.False(result);
    }

    // 11. Nonexistent guide returns failure cleanly
    [Fact]
    public async Task AssignGuideAsync_NonexistentGuide_ReturnsFalse()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db);

        var sut = CreateSut(db);
        var result = await sut.AssignGuideAsync(booking.Id, Guid.NewGuid());

        Assert.False(result);
    }

    // Invalid date range validation
    [Fact]
    public async Task AssignGuideAsync_StartDateAfterEndDate_ReturnsFalse()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db,
            startDate: new DateOnly(2026, 10, 20),
            endDate: new DateOnly(2026, 10, 10)); // Invalid: start > end
        var guide = SeedGuide(db, "Janindu");

        var sut = CreateSut(db);
        var result = await sut.AssignGuideAsync(booking.Id, guide.Id);

        Assert.False(result);
        Assert.Empty(db.GuideAvailabilities);
    }

    // 13. Concurrent/near-concurrent double-booking attempt fails cleanly
    [Fact]
    public async Task AssignGuideAsync_ConcurrentOverlappingAttempts_OnlyOneSucceeds()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking1) = SeedBooking(db,
            startDate: new DateOnly(2026, 10, 10),
            endDate: new DateOnly(2026, 10, 15));
        var (_, booking2) = SeedBooking(db,
            startDate: new DateOnly(2026, 10, 10),
            endDate: new DateOnly(2026, 10, 15));
        var guide = SeedGuide(db, "Janindu");

        var sut1 = CreateSut(db);
        var sut2 = CreateSut(db);

        var t1 = sut1.AssignGuideAsync(booking1.Id, guide.Id);
        var t2 = sut2.AssignGuideAsync(booking2.Id, guide.Id);

        var results = await Task.WhenAll(t1, t2);

        // One must succeed and one must fail
        Assert.Contains(true, results);
        Assert.Contains(false, results);

        // All rows in db belong to the single successful booking
        var successfulBookingId = results[0] ? booking1.Id : booking2.Id;
        var rows = db.GuideAvailabilities.Where(a => a.GuideId == guide.Id).ToList();
        Assert.Equal(6, rows.Count);
        Assert.All(rows, r => Assert.Equal(successfulBookingId, r.AssignedBookingId));
    }

    // 14. Existing GuideMatchingAgent MatchAsync remains read-only
    [Fact]
    public async Task GuideMatchingAgent_MatchAsync_RemainsReadOnly_DoesNotPerformWrites()
    {
        var db = TestDbContextFactory.Create();
        var (_, booking) = SeedBooking(db, theme: "Cultural");
        var guide = SeedGuide(db, name: "Janindu", specializations: new[] { "Cultural" });

        var availabilitySvc = new GuideAvailabilityService(db, NullLogger<GuideAvailabilityService>.Instance);
        var matchingAgent = new GuideMatchingAgent(db, availabilitySvc, NullLogger<GuideMatchingAgent>.Instance);

        var matchResult = await matchingAgent.MatchAsync(booking.Id);

        Assert.Equal(guide.Id, matchResult.GuideId);
        Assert.True(matchResult.MatchScore > 0);

        // Zero rows written by matching agent
        Assert.Empty(db.GuideAvailabilities);
    }

    // 15. PostgreSQL-relational concurrency test: concurrent update on existing free row
    [Fact]
    public async Task AssignGuideAsync_PostgreSql_ConcurrentUpdateOnExistingRow_OnlyOneSucceedsAndNoLostUpdate()
    {
        var connectionString = Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING")
            ?? "Host=localhost;Port=5432;Database=trailwise;Username=trailwise;Password=change_me_dev_password";

        DbContextOptions<TrailWiseDbContext> options;
        try
        {
            options = new DbContextOptionsBuilder<TrailWiseDbContext>()
                .UseNpgsql(connectionString)
                .Options;

            await using var testConn = new TrailWiseDbContext(options);
            if (!await testConn.Database.CanConnectAsync())
            {
                return; // Gracefully skip if PostgreSQL is not running in current environment
            }
        }
        catch
        {
            return; // Gracefully skip if Npgsql cannot connect
        }

        await using var dbSetup = new TrailWiseDbContext(options);

        var testDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(100));

        var guide = new Guide
        {
            Id = Guid.NewGuid(),
            Name = "Postgres Concurrency Guide",
            Specializations = new[] { "Cultural" },
            Languages = new[] { "English" },
            ContactInfo = "pg@test.com"
        };
        dbSetup.Guides.Add(guide);

        // Pre-existing row with AssignedBookingId = null and IsAvailable = true
        var existingRow = new GuideAvailability
        {
            Id = Guid.NewGuid(),
            GuideId = guide.Id,
            Date = testDate,
            IsAvailable = true,
            AssignedBookingId = null
        };
        dbSetup.GuideAvailabilities.Add(existingRow);

        var traveler = new User
        {
            Name = "PG Traveler",
            Email = $"pgtraveler-{Guid.NewGuid():N}@example.com",
            ContactNumber = "+123456789",
            PasswordHash = "hash",
            Role = UserRole.Traveler
        };
        dbSetup.Users.Add(traveler);

        var package = new TourPackage
        {
            Name = "PG Package",
            Theme = "Cultural",
            DurationDays = 1,
            BasePricePerPerson = 100m,
            MaxGroupSize = 10
        };
        dbSetup.TourPackages.Add(package);

        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = false,
            BasePricePerPerson = 100m,
            RequiresAC = false
        };
        dbSetup.PackageTiers.Add(tier);

        var booking1 = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = testDate,
            EndDate = testDate,
            BudgetPerPerson = 200m,
            Status = BookingStatus.Confirmed
        };
        var booking2 = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = testDate,
            EndDate = testDate,
            BudgetPerPerson = 200m,
            Status = BookingStatus.Confirmed
        };
        dbSetup.Bookings.AddRange(booking1, booking2);
        await dbSetup.SaveChangesAsync();

        try
        {
            await using var db1 = new TrailWiseDbContext(options);
            await using var db2 = new TrailWiseDbContext(options);

            var sut1 = new GuideAssignmentService(db1, NullLogger<GuideAssignmentService>.Instance);
            var sut2 = new GuideAssignmentService(db2, NullLogger<GuideAssignmentService>.Instance);

            var t1 = sut1.AssignGuideAsync(booking1.Id, guide.Id);
            var t2 = sut2.AssignGuideAsync(booking2.Id, guide.Id);

            var results = await Task.WhenAll(t1, t2);

            // Exactly one must succeed and one must fail
            Assert.Contains(true, results);
            Assert.Contains(false, results);

            // Verify in PostgreSQL: row is assigned to the ONE winning booking (no last-write-wins)
            await using var dbVerify = new TrailWiseDbContext(options);
            var updatedRow = await dbVerify.GuideAvailabilities.SingleAsync(a => a.GuideId == guide.Id && a.Date == testDate);
            var winningBookingId = results[0] ? booking1.Id : booking2.Id;

            Assert.Equal(winningBookingId, updatedRow.AssignedBookingId);
            Assert.False(updatedRow.IsAvailable);
        }
        finally
        {
            // Cleanup test rows
            var availabilities = dbSetup.GuideAvailabilities.Where(a => a.GuideId == guide.Id);
            dbSetup.GuideAvailabilities.RemoveRange(availabilities);
            dbSetup.Bookings.Remove(booking1);
            dbSetup.Bookings.Remove(booking2);
            dbSetup.PackageTiers.Remove(tier);
            dbSetup.TourPackages.Remove(package);
            dbSetup.Users.Remove(traveler);
            dbSetup.Guides.Remove(guide);
            await dbSetup.SaveChangesAsync();
        }
    }
}
