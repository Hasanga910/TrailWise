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

            db.TourPackages.Add(culturalPackage);
            await db.SaveChangesAsync(ct);
        }
    }
}
