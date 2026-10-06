using Microsoft.Extensions.Logging.Abstractions;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class GuideAvailabilityServiceTests
{
    private static GuideAvailabilityService CreateSut(Infrastructure.Persistence.TrailWiseDbContext db) =>
        new(db, NullLogger<GuideAvailabilityService>.Instance);

    private static Guide SeedGuide(Infrastructure.Persistence.TrailWiseDbContext db, string name = "Test Guide")
    {
        var guide = new Guide
        {
            Name = name,
            Languages = new[] { "English" },
            Specializations = new[] { "Cultural" }
        };
        db.Guides.Add(guide);
        db.SaveChanges();
        return guide;
    }

    [Fact]
    public async Task IsGuideAvailableAsync_StartDateAfterEndDate_ReturnsFalse()
    {
        var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);
        var guide = SeedGuide(db);

        var result = await sut.IsGuideAvailableAsync(
            guide.Id,
            new DateOnly(2026, 10, 15),
            new DateOnly(2026, 10, 10));

        Assert.False(result);
    }

    [Fact]
    public async Task IsGuideAvailableAsync_NonexistentGuide_ReturnsFalse()
    {
        var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.IsGuideAvailableAsync(
            Guid.NewGuid(),
            new DateOnly(2026, 10, 10),
            new DateOnly(2026, 10, 15));

        Assert.False(result);
    }

    [Fact]
    public async Task IsGuideAvailableAsync_NoRecordsInRange_ReturnsTrueByDefault()
    {
        var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);
        var guide = SeedGuide(db);

        var result = await sut.IsGuideAvailableAsync(
            guide.Id,
            new DateOnly(2026, 10, 10),
            new DateOnly(2026, 10, 15));

        Assert.True(result);
    }

    [Fact]
    public async Task IsGuideAvailableAsync_DateWithIsAvailableFalse_ReturnsFalse()
    {
        var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);
        var guide = SeedGuide(db);

        db.GuideAvailabilities.Add(new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 12),
            IsAvailable = false
        });
        await db.SaveChangesAsync();

        var result = await sut.IsGuideAvailableAsync(
            guide.Id,
            new DateOnly(2026, 10, 10),
            new DateOnly(2026, 10, 15));

        Assert.False(result);
    }

    [Fact]
    public async Task IsGuideAvailableAsync_DateWithAssignedBookingId_ReturnsFalse()
    {
        var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);
        var guide = SeedGuide(db);

        db.GuideAvailabilities.Add(new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 14),
            IsAvailable = true,
            AssignedBookingId = Guid.NewGuid()
        });
        await db.SaveChangesAsync();

        var result = await sut.IsGuideAvailableAsync(
            guide.Id,
            new DateOnly(2026, 10, 10),
            new DateOnly(2026, 10, 15));

        Assert.False(result);
    }

    [Fact]
    public async Task IsGuideAvailableAsync_ConflictOutsideDateRange_ReturnsTrue()
    {
        var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);
        var guide = SeedGuide(db);

        // Conflict is on Oct 20, but checking Oct 10 - 15
        db.GuideAvailabilities.Add(new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 20),
            IsAvailable = false
        });
        await db.SaveChangesAsync();

        var result = await sut.IsGuideAvailableAsync(
            guide.Id,
            new DateOnly(2026, 10, 10),
            new DateOnly(2026, 10, 15));

        Assert.True(result);
    }

    [Fact]
    public async Task IsGuideAvailableAsync_ExplicitAvailableRecords_ReturnsTrue()
    {
        var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);
        var guide = SeedGuide(db);

        db.GuideAvailabilities.Add(new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 10),
            IsAvailable = true
        });
        db.GuideAvailabilities.Add(new GuideAvailability
        {
            GuideId = guide.Id,
            Date = new DateOnly(2026, 10, 11),
            IsAvailable = true
        });
        await db.SaveChangesAsync();

        var result = await sut.IsGuideAvailableAsync(
            guide.Id,
            new DateOnly(2026, 10, 10),
            new DateOnly(2026, 10, 11));

        Assert.True(result);
    }
}
