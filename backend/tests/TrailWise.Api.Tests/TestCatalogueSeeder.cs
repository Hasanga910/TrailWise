using Microsoft.EntityFrameworkCore;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Tests;

/// <summary>
/// Test-owned fixture data for integration tests that need a catalogue to book against: a few packages with
/// tiers, discounts, vehicles, drivers and guides. The application itself seeds none of this (only the Admin).
/// </summary>
internal static class TestCatalogueSeeder
{
    public static async Task SeedAsync(TrailWiseDbContext db)
    {
        if (!await db.TourPackages.AnyAsync())
        {
            var cultural = Package("Cultural Triangle Explorer", "Cultural", 4, 250m, 12,
                new[] { "Sigiriya", "Anuradhapura", "Dambulla" },
                (ClassType.Normal, false, 250m, false), (ClassType.First, true, 420m, true));
            var hillCountry = Package("Hill Country Adventure", "Adventure", 5, 300m, 15,
                new[] { "Ella", "Nuwara Eliya", "Adam's Peak" },
                (ClassType.Normal, false, 300m, false), (ClassType.Second, true, 380m, false), (ClassType.First, true, 520m, true));
            var coastal = Package("Coastal Getaway", "Beach", 3, 220m, 20,
                new[] { "Mirissa", "Galle", "Bentota" },
                (ClassType.Normal, false, 220m, false), (ClassType.First, true, 360m, true));
            db.TourPackages.AddRange(cultural, hillCountry, coastal);
        }

        if (!await db.Discounts.AnyAsync())
        {
            db.Discounts.AddRange(
                new Discount { Description = "Group discount (10+ people)", PercentageOff = 10m, MinGroupSize = 10 },
                new Discount { Description = "Large group discount (15+ people)", PercentageOff = 15m, MinGroupSize = 15 });
        }

        if (!await db.Vehicles.AnyAsync())
        {
            db.Vehicles.AddRange(
                Vehicle(VehicleType.SUV, "WP-CAB-1234", 4),
                Vehicle(VehicleType.Van, "WP-ND-5678", 10),
                Vehicle(VehicleType.Coach, "WP-NB-9012", 30));
        }

        if (!await db.Drivers.AnyAsync())
        {
            db.Drivers.AddRange(
                new Driver { Name = "Sunil Jayawardena", LicenseNumber = "B-8472910", ContactInfo = "+94711122334" },
                new Driver { Name = "Kamal Perera", LicenseNumber = "B-9182734", ContactInfo = "+94772233445" },
                new Driver { Name = "Nimal Silva", LicenseNumber = "B-6352419", ContactInfo = "+94783344556" });
        }

        if (!await db.Guides.AnyAsync())
        {
            db.Guides.AddRange(
                new Guide { Name = "Rohan Fernando", ContactInfo = "+94771234567", Languages = new[] { "English", "Sinhala" }, Specializations = new[] { "Cultural", "Heritage" } },
                new Guide { Name = "Anura Wickramasinghe", ContactInfo = "+94772345678", Languages = new[] { "English", "German", "Sinhala" }, Specializations = new[] { "Adventure", "Hiking" } },
                new Guide { Name = "Dilshan Mendis", ContactInfo = "+94773456789", Languages = new[] { "English", "Sinhala", "French" }, Specializations = new[] { "Beach", "Coastal" } });
        }

        await db.SaveChangesAsync();
    }

    private static TourPackage Package(
        string name, string theme, int days, decimal price, int maxGroup, string[] locations,
        params (ClassType Class, bool Food, decimal Price, bool Ac)[] tiers)
    {
        var package = new TourPackage
        {
            Name = name,
            Theme = theme,
            DurationDays = days,
            BasePricePerPerson = price,
            MaxGroupSize = maxGroup
        };
        foreach (var t in tiers)
        {
            package.PackageTiers.Add(new PackageTier
            {
                ClassType = t.Class,
                IncludesFood = t.Food,
                BasePricePerPerson = t.Price,
                RequiresAC = t.Ac
            });
        }
        foreach (var location in locations)
        {
            package.Locations.Add(new PackageLocation { Name = location });
        }
        return package;
    }

    private static Vehicle Vehicle(VehicleType type, string registration, int capacity) => new()
    {
        Type = type,
        RegistrationNumber = registration,
        Capacity = capacity,
        HasAC = true,
        SeatConfiguration = $"{capacity} Passenger Seats",
        MaintenanceStatus = VehicleMaintenanceStatus.Available
    };
}
