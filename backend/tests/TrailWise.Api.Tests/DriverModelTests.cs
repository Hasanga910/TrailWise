using Microsoft.EntityFrameworkCore;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

/// <summary>
/// Guards the Drivers shape that migration AlignDriversWithModel brought the database in line with.
/// The model once changed (UserId, the User relation, a 200-character ContactInfo) without a
/// migration; if these expectations change again, a migration must change with them.
/// </summary>
public class DriverModelTests
{
    [Fact]
    public void Model_DefinesTheDriverUserLinkAndContactInfoLength()
    {
        using var db = TestDbContextFactory.Create();
        var driver = db.Model.FindEntityType(typeof(Driver))!;

        Assert.Equal(200, driver.FindProperty(nameof(Driver.ContactInfo))!.GetMaxLength());

        var userFk = Assert.Single(driver.GetForeignKeys(), fk => fk.PrincipalEntityType.ClrType == typeof(User));
        Assert.Equal(nameof(Driver.UserId), Assert.Single(userFk.Properties).Name);
        Assert.Equal(DeleteBehavior.SetNull, userFk.DeleteBehavior);

        var userIndex = Assert.Single(driver.GetIndexes(), i => i.Properties.Single().Name == nameof(Driver.UserId));
        Assert.True(userIndex.IsUnique);
        Assert.Null(userIndex.GetFilter());
    }

    [Fact]
    public async Task DeleteUser_ForADriverAccount_UnlinksTheDriverProfileAndKeepsIt()
    {
        using var db = TestDbContextFactory.Create();
        var user = new User
        {
            Name = "Driver Account",
            Email = $"driver-{Guid.NewGuid():N}@example.com",
            ContactNumber = "+94700000000",
            PasswordHash = "irrelevant",
            Role = UserRole.Driver
        };
        var driver = new Driver { Name = "Linked Driver", LicenseNumber = "L-1", ContactInfo = "+94700000000", User = user };
        db.AddRange(user, driver);
        await db.SaveChangesAsync();
        var admin = Guid.NewGuid();

        // On PostgreSQL the foreign key does the unlinking (ON DELETE SET NULL, verified against a
        // real database when the migration was written); EF applies the same rule to a tracked driver.
        var result = await new AuthService(db, new StubTokenService()).DeleteUserAsync(user.Id, admin);

        Assert.True(result.Succeeded);
        var kept = await db.Drivers.SingleAsync(d => d.Id == driver.Id);
        Assert.Null(kept.UserId);
        Assert.False(await db.Users.AnyAsync(u => u.Id == user.Id));
    }
}
