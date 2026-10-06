using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class ApprovalBackfillTests
{
    [Fact]
    public async Task Seeder_GivesPendingApprovalBookingsAnOpenRequest_AndIsIdempotent()
    {
        var db = TestDbContextFactory.Create();
        var large = await SeedBookingAsync(db, groupSize: 12, BookingStatus.PendingApproval);
        var budget = await SeedBookingAsync(db, groupSize: 2, BookingStatus.PendingApproval);
        var confirmed = await SeedBookingAsync(db, groupSize: 12, BookingStatus.Confirmed);

        var options = Options.Create(new AdminSeedOptions());
        await DbSeeder.SeedAsync(db, options);
        await DbSeeder.SeedAsync(db, options);

        var requests = await db.ApprovalRequests.ToListAsync();
        Assert.Equal(2, requests.Count);
        Assert.Equal(ApprovalType.LargeGroupOrCustomItinerary, requests.Single(r => r.BookingId == large).Type);
        Assert.Equal(ApprovalType.BudgetOverride, requests.Single(r => r.BookingId == budget).Type);
        Assert.All(requests, r => Assert.Equal(ApprovalStatus.Pending, r.Status));
        Assert.DoesNotContain(requests, r => r.BookingId == confirmed);
    }

    private static async Task<Guid> SeedBookingAsync(TrailWiseDbContext db, int groupSize, BookingStatus status)
    {
        var traveler = new User
        {
            Name = "Backfill Traveler",
            Email = $"backfill-{Guid.NewGuid():N}@example.com",
            ContactNumber = "+14155550100",
            PasswordHash = "irrelevant",
            Role = UserRole.Traveler
        };
        var package = new TourPackage { Name = "Backfill Package", Theme = "Test", DurationDays = 3, BasePricePerPerson = 100m, MaxGroupSize = 50 };
        var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, BasePricePerPerson = 100m };
        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = groupSize,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(33)),
            BudgetPerPerson = 100m,
            Status = status
        };
        db.Add(booking);
        await db.SaveChangesAsync();
        return booking.Id;
    }
}
