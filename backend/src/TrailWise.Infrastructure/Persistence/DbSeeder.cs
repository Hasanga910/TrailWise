using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Options;

namespace TrailWise.Infrastructure.Persistence;

public static class DbSeeder
{
    public static async Task SeedAsync(
        TrailWiseDbContext db,
        IOptions<AdminSeedOptions> adminOptions,
        CancellationToken ct = default,
        ILogger? logger = null)
    {
        if (db.Database.IsRelational())
        {
            await db.Database.MigrateAsync(ct);
            // Ensure schema updates that were added without an EF migration are applied safely
            try
            {
                await db.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE \"Drivers\" ADD COLUMN IF NOT EXISTS \"UserId\" uuid REFERENCES \"Users\"(\"Id\"); " +
                    "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Drivers_UserId\" ON \"Drivers\" (\"UserId\") WHERE \"UserId\" IS NOT NULL;",
                    ct);
            }
            catch
            {
                // Ignore if already applied or not supported
            }
        }
        else
        {
            await db.Database.EnsureCreatedAsync(ct);
        }

        await BackfillApprovalRequestsAsync(db, ct);

        var admin = adminOptions.Value;
        if (!string.IsNullOrWhiteSpace(admin.Email) && !string.IsNullOrWhiteSpace(admin.Password))
        {
            var normalizedEmail = admin.Email.Trim().ToLowerInvariant();
            var exists = await db.Users.AnyAsync(u => u.Email == normalizedEmail, ct);
            if (!exists)
            {
                var hasher = new PasswordHasher<User>();
                var adminUser = new User
                {
                    Name = admin.Name,
                    Email = normalizedEmail,
                    ContactNumber = admin.ContactNumber,
                    Role = UserRole.Admin
                };
                adminUser.PasswordHash = hasher.HashPassword(adminUser, admin.Password);
                db.Users.Add(adminUser);
                await db.SaveChangesAsync(ct);
            }
        }

        var driverEmail = "driver@trailwise.local";
        var driverUserExists = await db.Users.AnyAsync(u => u.Email == driverEmail, ct);
        if (!driverUserExists)
        {
            var hasher = new PasswordHasher<User>();
            var driverUser = new User
            {
                Name = "Sunil Jayawardena",
                Email = driverEmail,
                ContactNumber = "+94711122334",
                Role = UserRole.Driver
            };
            driverUser.PasswordHash = hasher.HashPassword(driverUser, "ChangeMe123!");
            db.Users.Add(driverUser);
            await db.SaveChangesAsync(ct);
        }

        if (!await db.TourPackages.AnyAsync(ct))
        {
            var culturalPackage = new TourPackage
            {
                Name = "Cultural Triangle Explorer",
                Theme = "Cultural",
                DurationDays = 4,
                BasePricePerPerson = 250m,
                MaxGroupSize = 12
            };
            culturalPackage.PackageTiers.Add(new PackageTier
            {
                ClassType = ClassType.Normal,
                IncludesFood = false,
                BasePricePerPerson = 250m,
                RequiresAC = false
            });
            culturalPackage.PackageTiers.Add(new PackageTier
            {
                ClassType = ClassType.First,
                IncludesFood = true,
                BasePricePerPerson = 420m,
                RequiresAC = true
            });
            culturalPackage.Locations.Add(new PackageLocation { Name = "Sigiriya" });
            culturalPackage.Locations.Add(new PackageLocation { Name = "Anuradhapura" });
            culturalPackage.Locations.Add(new PackageLocation { Name = "Dambulla" });

            var hillCountryPackage = new TourPackage
            {
                Name = "Hill Country Adventure",
                Theme = "Adventure",
                DurationDays = 5,
                BasePricePerPerson = 300m,
                MaxGroupSize = 15
            };
            hillCountryPackage.PackageTiers.Add(new PackageTier
            {
                ClassType = ClassType.Normal,
                IncludesFood = false,
                BasePricePerPerson = 300m,
                RequiresAC = false
            });
            hillCountryPackage.PackageTiers.Add(new PackageTier
            {
                ClassType = ClassType.Second,
                IncludesFood = true,
                BasePricePerPerson = 380m,
                RequiresAC = false
            });
            hillCountryPackage.PackageTiers.Add(new PackageTier
            {
                ClassType = ClassType.First,
                IncludesFood = true,
                BasePricePerPerson = 520m,
                RequiresAC = true
            });
            hillCountryPackage.Locations.Add(new PackageLocation { Name = "Ella" });
            hillCountryPackage.Locations.Add(new PackageLocation { Name = "Nuwara Eliya" });
            hillCountryPackage.Locations.Add(new PackageLocation { Name = "Adam's Peak" });

            var coastalPackage = new TourPackage
            {
                Name = "Coastal Getaway",
                Theme = "Beach",
                DurationDays = 3,
                BasePricePerPerson = 220m,
                MaxGroupSize = 20
            };
            coastalPackage.PackageTiers.Add(new PackageTier
            {
                ClassType = ClassType.Normal,
                IncludesFood = false,
                BasePricePerPerson = 220m,
                RequiresAC = false
            });
            coastalPackage.PackageTiers.Add(new PackageTier
            {
                ClassType = ClassType.First,
                IncludesFood = true,
                BasePricePerPerson = 360m,
                RequiresAC = true
            });
            coastalPackage.Locations.Add(new PackageLocation { Name = "Mirissa" });
            coastalPackage.Locations.Add(new PackageLocation { Name = "Galle" });
            coastalPackage.Locations.Add(new PackageLocation { Name = "Bentota" });

            db.TourPackages.AddRange(culturalPackage, hillCountryPackage, coastalPackage);
            await db.SaveChangesAsync(ct);
        }

        if (!await db.Discounts.AnyAsync(ct))
        {
            db.Discounts.AddRange(
                new Discount
                {
                    Description = "Group discount (10+ people)",
                    PercentageOff = 10m,
                    MinGroupSize = 10
                },
                new Discount
                {
                    Description = "Large group discount (15+ people)",
                    PercentageOff = 15m,
                    MinGroupSize = 15
                });
            await db.SaveChangesAsync(ct);
        }

        if (!await db.Vehicles.AnyAsync(ct))
        {
            db.Vehicles.AddRange(
                new Vehicle
                {
                    Type = VehicleType.SUV,
                    RegistrationNumber = "WP-CAB-1234",
                    Capacity = 4,
                    HasAC = true,
                    SeatConfiguration = "4 Passenger Seats",
                    MaintenanceStatus = VehicleMaintenanceStatus.Available
                },
                new Vehicle
                {
                    Type = VehicleType.Van,
                    RegistrationNumber = "WP-ND-5678",
                    Capacity = 10,
                    HasAC = true,
                    SeatConfiguration = "10 Passenger Seats",
                    MaintenanceStatus = VehicleMaintenanceStatus.Available
                },
                new Vehicle
                {
                    Type = VehicleType.Coach,
                    RegistrationNumber = "WP-NB-9012",
                    Capacity = 30,
                    HasAC = true,
                    SeatConfiguration = "30 Passenger Seats",
                    MaintenanceStatus = VehicleMaintenanceStatus.Available
                });
            await db.SaveChangesAsync(ct);
        }

        if (!await db.Drivers.AnyAsync(ct))
        {
            var driverUser = await db.Users.FirstOrDefaultAsync(u => u.Email == driverEmail, ct);
            db.Drivers.AddRange(
                new Driver
                {
                    UserId = driverUser?.Id,
                    Name = "Sunil Jayawardena",
                    LicenseNumber = "B-8472910",
                    ContactInfo = "+94711122334"
                },
                new Driver
                {
                    Name = "Kamal Perera",
                    LicenseNumber = "B-9182734",
                    ContactInfo = "+94772233445"
                },
                new Driver
                {
                    Name = "Nimal Silva",
                    LicenseNumber = "B-6352419",
                    ContactInfo = "+94783344556"
                });
            await db.SaveChangesAsync(ct);
        }

        // Driver records that predate Driver.UserId: link to the matching Driver account, but only
        // when the contact number identifies exactly one driver and one account (never by name).
        await DriverAccountLinker.LinkUnambiguousAsync(db, logger, ct);

        if (!await db.Guides.AnyAsync(ct))
        {
            db.Guides.AddRange(
                new Guide
                {
                    Name = "Rohan Fernando",
                    ContactInfo = "+94771234567",
                    Languages = new[] { "English", "Sinhala" },
                    Specializations = new[] { "Cultural", "Heritage" }
                },
                new Guide
                {
                    Name = "Anura Wickramasinghe",
                    ContactInfo = "+94772345678",
                    Languages = new[] { "English", "German", "Sinhala" },
                    Specializations = new[] { "Adventure", "Hiking" }
                },
                new Guide
                {
                    Name = "Dilshan Mendis",
                    ContactInfo = "+94773456789",
                    Languages = new[] { "English", "Sinhala", "French" },
                    Specializations = new[] { "Beach", "Coastal" }
                });
            await db.SaveChangesAsync(ct);
        }
    }
    /// <summary>
    /// Bookings that were already waiting in PendingApproval before approval requests existed get an
    /// open request, so they show up in the approvals queue. Idempotent.
    /// </summary>
    private static async Task BackfillApprovalRequestsAsync(TrailWiseDbContext db, CancellationToken ct)
    {
        var orphans = await db.Bookings
            .Where(b => b.Status == BookingStatus.PendingApproval
                && !db.ApprovalRequests.Any(a => a.BookingId == b.Id && a.Status == ApprovalStatus.Pending))
            .ToListAsync(ct);
        if (orphans.Count == 0)
        {
            return;
        }

        foreach (var booking in orphans)
        {
            db.ApprovalRequests.Add(new ApprovalRequest
            {
                BookingId = booking.Id,
                Type = Agents.BookingApprovalEvaluator.ClassifyApprovalType(booking.GroupSize),
                Status = ApprovalStatus.Pending,
                PreviousBookingStatus = BookingStatus.Requested,
                RequestedAt = booking.UpdatedAt,
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
