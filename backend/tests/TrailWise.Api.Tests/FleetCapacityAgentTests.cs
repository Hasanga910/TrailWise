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

    [Fact]
    public async Task MatchAsync_VehicleHasDateOverlapConflict_AvoidsConflictingVehicle()
    {
        var db = TestDbContextFactory.Create();

        // Vehicle A has capacity 10 and AC, but is booked for overlapping dates
        var bookedVehicle = new Vehicle
        {
            Type = VehicleType.Van,
            Capacity = 10,
            HasAC = true,
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        };
        // Vehicle B has capacity 10 and AC, free for the dates
        var freeVehicle = new Vehicle
        {
            Type = VehicleType.Van,
            Capacity = 10,
            HasAC = true,
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        };
        db.Vehicles.AddRange(bookedVehicle, freeVehicle);

        var driver = new Driver { Name = "Active Driver", LicenseNumber = "D-FREE-1", ContactInfo = "123" };
        var busyDriver = new Driver { Name = "Busy Driver", LicenseNumber = "D-BUSY-1", ContactInfo = "456" };
        db.Drivers.AddRange(driver, busyDriver);

        var package = new TourPackage { Name = "Safari", Theme = "Wild", DurationDays = 3, BasePricePerPerson = 150m, MaxGroupSize = 20 };
        var tier = new PackageTier { TourPackage = package, ClassType = ClassType.First, BasePricePerPerson = 150m, RequiresAC = true };
        var traveler = new User { Name = "T", Email = $"t-{Guid.NewGuid():N}@test.com", ContactNumber = "+111", PasswordHash = "h", Role = UserRole.Traveler };

        var startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));
        var endDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8));

        // Existing booking creating an assignment on bookedVehicle
        var existingBooking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 4,
            StartDate = startDate,
            EndDate = endDate,
            BudgetPerPerson = 300m
        };
        db.Bookings.Add(existingBooking);

        var assignment = new VehicleAssignment
        {
            Vehicle = bookedVehicle,
            Driver = busyDriver,
            Booking = existingBooking,
            StartDate = startDate,
            EndDate = endDate
        };
        db.VehicleAssignments.Add(assignment);

        // Target booking overlapping with existing assignment
        var targetBooking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 4,
            StartDate = startDate.AddDays(1),
            EndDate = endDate.AddDays(2),
            BudgetPerPerson = 300m
        };
        db.Bookings.Add(targetBooking);
        await db.SaveChangesAsync();

        var sut = new FleetCapacityAgent(db, NullLogger<FleetCapacityAgent>.Instance);
        var result = await sut.MatchAsync(targetBooking.Id);

        // Must select the free vehicle and free driver, NOT the overlapping ones
        Assert.Equal(freeVehicle.Id, result.VehicleId);
        Assert.Equal(driver.Id, result.DriverId);
        Assert.True(result.AcMatch);
        Assert.True(result.SeatConfigMatch);
        Assert.False(result.ConflictCheck);
    }

    [Fact]
    public async Task MatchAsync_VehicleUnderMaintenance_IsExcludedFromMatching()
    {
        var db = TestDbContextFactory.Create();

        var underMaintenanceVehicle = new Vehicle
        {
            Type = VehicleType.Coach,
            Capacity = 30,
            HasAC = true,
            MaintenanceStatus = VehicleMaintenanceStatus.UnderMaintenance
        };
        db.Vehicles.Add(underMaintenanceVehicle);

        var driver = new Driver { Name = "Driver 1", LicenseNumber = "D-111", ContactInfo = "123" };
        db.Drivers.Add(driver);

        var package = new TourPackage { Name = "P", Theme = "T", DurationDays = 2, BasePricePerPerson = 100m, MaxGroupSize = 50 };
        var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, BasePricePerPerson = 100m, RequiresAC = true };
        var traveler = new User { Name = "U", Email = $"u-{Guid.NewGuid():N}@test.com", ContactNumber = "+111", PasswordHash = "h", Role = UserRole.Traveler };
        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 25,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(4)),
            BudgetPerPerson = 200m
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var sut = new FleetCapacityAgent(db, NullLogger<FleetCapacityAgent>.Instance);
        var result = await sut.MatchAsync(booking.Id);

        // No available vehicle in service
        Assert.Equal(Guid.Empty, result.VehicleId);
        Assert.True(result.ConflictCheck);
    }

    [Fact]
    public async Task MatchAsync_AllDriversBookedForDates_ReturnsConflict()
    {
        var db = TestDbContextFactory.Create();

        var vehicle = new Vehicle
        {
            Type = VehicleType.Van,
            Capacity = 10,
            HasAC = true,
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        };
        db.Vehicles.Add(vehicle);

        var busyDriver = new Driver { Name = "Only Driver", LicenseNumber = "D-BUSY-ONLY", ContactInfo = "123" };
        db.Drivers.Add(busyDriver);

        var package = new TourPackage { Name = "P", Theme = "T", DurationDays = 2, BasePricePerPerson = 100m, MaxGroupSize = 20 };
        var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, BasePricePerPerson = 100m, RequiresAC = false };
        var traveler = new User { Name = "U", Email = $"u-{Guid.NewGuid():N}@test.com", ContactNumber = "+111", PasswordHash = "h", Role = UserRole.Traveler };

        var startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10));
        var endDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(12));

        var priorBooking = new Booking { Traveler = traveler, TourPackage = package, PackageTier = tier, GroupSize = 2, StartDate = startDate, EndDate = endDate, BudgetPerPerson = 200m };
        db.Bookings.Add(priorBooking);

        // Driver is assigned to another vehicle/booking for these dates
        db.VehicleAssignments.Add(new VehicleAssignment
        {
            VehicleId = Guid.NewGuid(),
            Driver = busyDriver,
            Booking = priorBooking,
            StartDate = startDate,
            EndDate = endDate
        });

        var targetBooking = new Booking { Traveler = traveler, TourPackage = package, PackageTier = tier, GroupSize = 4, StartDate = startDate, EndDate = endDate, BudgetPerPerson = 200m };
        db.Bookings.Add(targetBooking);
        await db.SaveChangesAsync();

        var sut = new FleetCapacityAgent(db, NullLogger<FleetCapacityAgent>.Instance);
        var result = await sut.MatchAsync(targetBooking.Id);

        // Vehicle is free, but no driver is available
        Assert.Equal(Guid.Empty, result.DriverId);
        Assert.True(result.ConflictCheck);
    }

    [Fact]
    public async Task MatchAsync_MultipleSuitableVehiclesAvailable_SelectsVehicleWithLeastUnusedCapacity()
    {
        var db = TestDbContextFactory.Create();

        // 3 suitable available vehicles with capacities 12, 4, and 8
        var largeCoach = new Vehicle
        {
            Type = VehicleType.Coach,
            Capacity = 12,
            HasAC = true,
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        };
        var smallCar = new Vehicle
        {
            Type = VehicleType.SUV,
            Capacity = 4,
            HasAC = true,
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        };
        var mediumVan = new Vehicle
        {
            Type = VehicleType.Van,
            Capacity = 8,
            HasAC = true,
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        };
        db.Vehicles.AddRange(largeCoach, smallCar, mediumVan);

        var driver = new Driver { Name = "Available Driver", LicenseNumber = "D-1", ContactInfo = "0771234567" };
        db.Drivers.Add(driver);

        var package = new TourPackage { Name = "P", Theme = "T", DurationDays = 2, BasePricePerPerson = 100m, MaxGroupSize = 20 };
        var tier = new PackageTier { TourPackage = package, ClassType = ClassType.First, BasePricePerPerson = 100m, RequiresAC = true };
        var traveler = new User { Name = "U", Email = $"u-{Guid.NewGuid():N}@test.com", ContactNumber = "+111", PasswordHash = "h", Role = UserRole.Traveler };

        // Booking with 3 guests -> smallCar (Capacity 4) has least unused capacity (1 unused seat)
        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 3,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
            BudgetPerPerson = 200m
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var sut = new FleetCapacityAgent(db, NullLogger<FleetCapacityAgent>.Instance);
        var result = await sut.MatchAsync(booking.Id);

        // Must assign the 4-seater (smallCar), NOT the 8-seater or 12-seater
        Assert.Equal(smallCar.Id, result.VehicleId);
        Assert.Equal(driver.Id, result.DriverId);
        Assert.True(result.AcMatch);
        Assert.True(result.SeatConfigMatch);
        Assert.False(result.ConflictCheck);
    }
}

