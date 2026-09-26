using Microsoft.Extensions.Logging.Abstractions;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class FleetCapacityAgentTests
{
    [Fact]
    public async Task MatchAsync_BookingNotFound_ReturnsConflictResult()
    {
        var db = TestDbContextFactory.Create();
        var sut = new FleetCapacityAgent(db, NullLogger<FleetCapacityAgent>.Instance);

        var result = await sut.MatchAsync(Guid.NewGuid());

        Assert.Equal(Guid.Empty, result.VehicleId);
        Assert.Equal(Guid.Empty, result.DriverId);
        Assert.False(result.AcMatch);
        Assert.False(result.SeatConfigMatch);
        Assert.True(result.ConflictCheck);
    }

    [Fact]
    public async Task MatchAsync_MatchingVehicleAndDriverAvailable_ReturnsSuccess()
    {
        var db = TestDbContextFactory.Create();

        var vehicle = new Vehicle
        {
            Type = VehicleType.Van,
            Capacity = 10,
            HasAC = true,
            SeatConfiguration = "2-2-3-3",
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        };
        db.Vehicles.Add(vehicle);

        var driver = new Driver
        {
            Name = "John Doe",
            LicenseNumber = "DL12345",
            ContactInfo = "+123456789"
        };
        db.Drivers.Add(driver);

        var package = new TourPackage
        {
            Name = "Test Package",
            Theme = "Adventure",
            DurationDays = 3,
            BasePricePerPerson = 100m,
            MaxGroupSize = 20
        };
        db.TourPackages.Add(package);

        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = true,
            BasePricePerPerson = 100m,
            RequiresAC = true
        };
        db.PackageTiers.Add(tier);

        var traveler = new User
        {
            Name = "Jane Doe",
            Email = $"traveler-{Guid.NewGuid():N}@test.com",
            ContactNumber = "+1987654321",
            PasswordHash = "hashed",
            Role = UserRole.Traveler
        };
        db.Users.Add(traveler);

        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 4,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(4)),
            BudgetPerPerson = 200m,
            Status = BookingStatus.Requested
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var sut = new FleetCapacityAgent(db, NullLogger<FleetCapacityAgent>.Instance);
        var result = await sut.MatchAsync(booking.Id);

        Assert.Equal(vehicle.Id, result.VehicleId);
        Assert.Equal(driver.Id, result.DriverId);
        Assert.True(result.AcMatch);
        Assert.True(result.SeatConfigMatch);
        Assert.False(result.ConflictCheck);
    }

    [Fact]
    public async Task MatchAsync_VehicleCapacityTooSmall_ReturnsConflict()
    {
        var db = TestDbContextFactory.Create();

        var vehicle = new Vehicle
        {
            Type = VehicleType.SUV,
            Capacity = 3, // Smaller than group size 6
            HasAC = true,
            SeatConfiguration = "standard",
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        };
        db.Vehicles.Add(vehicle);

        var driver = new Driver
        {
            Name = "John Doe",
            LicenseNumber = "DL12345",
            ContactInfo = "+123456789"
        };
        db.Drivers.Add(driver);

        var package = new TourPackage { Name = "P", Theme = "T", DurationDays = 2, BasePricePerPerson = 100m, MaxGroupSize = 20 };
        var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, BasePricePerPerson = 100m, RequiresAC = false };
        var traveler = new User { Name = "U", Email = $"u-{Guid.NewGuid():N}@test.com", ContactNumber = "+111", PasswordHash = "h", Role = UserRole.Traveler };
        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 6,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            BudgetPerPerson = 200m
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var sut = new FleetCapacityAgent(db, NullLogger<FleetCapacityAgent>.Instance);
        var result = await sut.MatchAsync(booking.Id);

        Assert.True(result.ConflictCheck);
    }
}
