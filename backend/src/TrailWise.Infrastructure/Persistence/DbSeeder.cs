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
                    Role = UserRole.Admin
                };
                adminUser.PasswordHash = hasher.HashPassword(adminUser, admin.Password);
                db.Users.Add(adminUser);
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

            db.TourPackages.AddRange(culturalPackage, hillCountryPackage, coastalPackage);
            await db.SaveChangesAsync(ct);
        }
    }
}
