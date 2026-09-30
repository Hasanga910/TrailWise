using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Options;

namespace TrailWise.Infrastructure.Persistence;

public static class DbSeeder
{
    public static async Task SeedAsync(TrailWiseDbContext db, IOptions<AdminSeedOptions> adminOptions, CancellationToken ct = default)
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

            var driverProfile = await db.Drivers.FirstOrDefaultAsync(d => d.ContactInfo == "+94711122334" || d.Name == "Sunil Jayawardena", ct);
            if (driverProfile != null)
            {
                driverProfile.UserId = driverUser.Id;
                await db.SaveChangesAsync(ct);
            }
        }
        else
        {
            var driverUser = await db.Users.FirstAsync(u => u.Email == driverEmail, ct);
            var driverProfile = await db.Drivers.FirstOrDefaultAsync(d => d.ContactInfo == "+94711122334" || d.Name == "Sunil Jayawardena", ct);
            if (driverProfile != null && driverProfile.UserId != driverUser.Id)
            {
                driverProfile.UserId = driverUser.Id;
                await db.SaveChangesAsync(ct);
            }
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
    }
}
