using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class DbSeederTests
{
    private static IOptions<AdminSeedOptions> AdminOptions(string email = "first-admin@example.com") =>
        Options.Create(new AdminSeedOptions { Name = "First Admin", Email = email, Password = "Seed-Pass-123!" });

    [Fact]
    public async Task SeedAsync_OnAnEmptyDatabase_CreatesOnlyTheAdmin()
    {
        using var db = TestDbContextFactory.Create();

        await DbSeeder.SeedAsync(db, AdminOptions());

        var admin = await db.Users.SingleAsync();
        Assert.Equal(UserRole.Admin, admin.Role);
        Assert.Equal("first-admin@example.com", admin.Email);
        Assert.Empty(await db.TourPackages.ToListAsync());
        Assert.Empty(await db.PackageTiers.ToListAsync());
        Assert.Empty(await db.Discounts.ToListAsync());
        Assert.Empty(await db.Vehicles.ToListAsync());
        Assert.Empty(await db.Drivers.ToListAsync());
        Assert.Empty(await db.Guides.ToListAsync());
    }

    [Fact]
    public async Task SeedAsync_IsIdempotent()
    {
        using var db = TestDbContextFactory.Create();

        await DbSeeder.SeedAsync(db, AdminOptions());
        await DbSeeder.SeedAsync(db, AdminOptions());

        Assert.Equal(1, await db.Users.CountAsync());
    }

    [Fact]
    public async Task SeedAsync_WhenAnAdminAlreadyExists_DoesNotCreateAnother()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User
        {
            Name = "Existing Admin",
            Email = "existing-admin@example.com",
            ContactNumber = "+94000000001",
            PasswordHash = "irrelevant",
            Role = UserRole.Admin
        });
        await db.SaveChangesAsync();

        await DbSeeder.SeedAsync(db, AdminOptions("another-admin@example.com"));

        var admin = await db.Users.SingleAsync();
        Assert.Equal("existing-admin@example.com", admin.Email);
    }

    [Fact]
    public async Task SeedAsync_WithoutAdminCredentials_CreatesNoUsers()
    {
        using var db = TestDbContextFactory.Create();

        await DbSeeder.SeedAsync(db, Options.Create(new AdminSeedOptions { Email = "", Password = "" }));

        Assert.Empty(await db.Users.ToListAsync());
    }
}
