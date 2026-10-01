using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class BookingNotificationServiceTests
{
    private class FakeSmsService : ISmsService
    {
        public List<(string Phone, string Message)> SentMessages { get; } = new();

        public Task SendSmsAsync(string recipientPhone, string message)
        {
            SentMessages.Add((recipientPhone, message));
            return Task.CompletedTask;
        }
    }

    private static DbContextOptions<TrailWiseDbContext> CreateInMemoryOptions()
    {
        return new DbContextOptionsBuilder<TrailWiseDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
    }

    [Fact]
    public async Task SendBookingConfirmedNotificationsAsync_DispatchesTailoredPayloads_ToTravelerDriverAndGuide()
    {
        var options = CreateInMemoryOptions();
        using var db = new TrailWiseDbContext(options);

        var traveler = new User
        {
            Id = Guid.NewGuid(),
            Name = "Alice Silva",
            Email = "alice@example.com",
            ContactNumber = "0771112233",
            PasswordHash = "hash",
            Role = UserRole.Traveler
        };

        var driverUser = new User
        {
            Id = Guid.NewGuid(),
            Name = "Sunil Driver",
            Email = "sunil@example.com",
            ContactNumber = "0772223344",
            PasswordHash = "hash",
            Role = UserRole.FleetCoordinator
        };

        var driver = new Driver
        {
            Id = Guid.NewGuid(),
            Name = "Sunil Perera",
            LicenseNumber = "DL12345",
            ContactInfo = "0772223344",
            UserId = driverUser.Id,
            User = driverUser
        };

        var guideUser = new User
        {
            Id = Guid.NewGuid(),
            Name = "Kamal Guide",
            Email = "kamal@example.com",
            ContactNumber = "0773334455",
            PasswordHash = "hash",
            Role = UserRole.TourGuide
        };

        var guide = new Guide
        {
            Id = Guid.NewGuid(),
            Name = "Kamal Fernando",
            ContactInfo = "0773334455",
            UserId = guideUser.Id,
            User = guideUser
        };

        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            Type = VehicleType.Van,
            RegistrationNumber = "WP-CAB-1234",
            Capacity = 8,
            HasAC = true
        };

        var package = new TourPackage
        {
            Id = Guid.NewGuid(),
            Name = "Hill Country Odyssey",
            Theme = "Scenic",
            DurationDays = 3,
            BasePricePerPerson = 250m,
            MaxGroupSize = 8
        };

        var tier = new PackageTier
        {
            Id = Guid.NewGuid(),
            TourPackageId = package.Id,
            ClassType = ClassType.First,
            BasePricePerPerson = 250m,
            RequiresAC = true
        };

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            TravelerId = traveler.Id,
            Traveler = traveler,
            TourPackageId = package.Id,
            TourPackage = package,
            PackageTierId = tier.Id,
            PackageTier = tier,
            StartDate = new DateOnly(2026, 12, 1),
            EndDate = new DateOnly(2026, 12, 3),
            GroupSize = 2,
            Status = BookingStatus.Confirmed
        };

        var vehicleAssignment = new VehicleAssignment
        {
            Id = Guid.NewGuid(),
            BookingId = booking.Id,
            VehicleId = vehicle.Id,
            Vehicle = vehicle,
            DriverId = driver.Id,
            Driver = driver,
            StartDate = booking.StartDate,
            EndDate = booking.EndDate
        };

        var guideAvailability = new GuideAvailability
        {
            Id = Guid.NewGuid(),
            GuideId = guide.Id,
            Guide = guide,
            Date = booking.StartDate,
            IsAvailable = false,
            AssignedBookingId = booking.Id
        };

        db.Users.AddRange(traveler, driverUser, guideUser);
        db.Drivers.Add(driver);
        db.Guides.Add(guide);
        db.Vehicles.Add(vehicle);
        db.TourPackages.Add(package);
        db.PackageTiers.Add(tier);
        db.Bookings.Add(booking);
        db.VehicleAssignments.Add(vehicleAssignment);
        db.GuideAvailabilities.Add(guideAvailability);
        await db.SaveChangesAsync();

        var fakeSmsService = new FakeSmsService();
        var notificationService = new BookingNotificationService(
            db,
            fakeSmsService,
            NullLogger<BookingNotificationService>.Instance);

        await notificationService.SendBookingConfirmedNotificationsAsync(booking.Id);

        // Only 1 SMS message sent to the Traveler
        Assert.Single(fakeSmsService.SentMessages);

        var travelerMsg = fakeSmsService.SentMessages.First();
        Assert.Equal("0771112233", travelerMsg.Phone);
        Assert.Contains("Hill Country Odyssey", travelerMsg.Message);
        Assert.Contains("2026-12-01 to 2026-12-03", travelerMsg.Message);
        Assert.Contains("WP-CAB-1234", travelerMsg.Message);
        Assert.Contains("Sunil Perera", travelerMsg.Message);

        // Ensure length is strictly under standard single-page SMS limit (160 characters)
        Assert.True(travelerMsg.Message.Length <= 160, $"Message length {travelerMsg.Message.Length} exceeds 160 characters.");
    }
}
