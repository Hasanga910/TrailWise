using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class DriverAccountLinkerTests
{
    private const string Phone = "+94770001111";

    [Fact]
    public async Task LinksASingleUnambiguousPhoneMatch_AndLogsOnlyIds()
    {
        using var db = TestDbContextFactory.Create();
        var user = AddUser(db, "Pat Driver", Phone);
        var driver = AddDriver(db, "Pat Driver Record", Phone);
        await db.SaveChangesAsync();
        var logger = new CollectingLogger();

        var linked = await DriverAccountLinker.LinkUnambiguousAsync(db, logger);

        Assert.Equal(1, linked);
        Assert.Equal(user.Id, (await db.Drivers.SingleAsync(d => d.Id == driver.Id)).UserId);
        var entry = Assert.Single(logger.Entries, e => e.Level == LogLevel.Information);
        Assert.Contains(driver.Id.ToString(), entry.Message);
        Assert.Contains(user.Id.ToString(), entry.Message);
        Assert.DoesNotContain(Phone, entry.Message);
    }

    [Fact]
    public async Task MatchesAfterTrimmingWhitespace()
    {
        using var db = TestDbContextFactory.Create();
        var user = AddUser(db, "Trim Driver", $" {Phone} ");
        var driver = AddDriver(db, "Trim Record", $"{Phone}  ");
        await db.SaveChangesAsync();

        Assert.Equal(1, await DriverAccountLinker.LinkUnambiguousAsync(db));

        Assert.Equal(user.Id, (await db.Drivers.SingleAsync(d => d.Id == driver.Id)).UserId);
    }

    [Fact]
    public async Task SkipsAmbiguousMatches_TwoDriverRecordsOnePhone()
    {
        using var db = TestDbContextFactory.Create();
        AddUser(db, "Ambiguous", Phone);
        AddDriver(db, "First Record", Phone);
        AddDriver(db, "Second Record", Phone);
        await db.SaveChangesAsync();
        var logger = new CollectingLogger();

        Assert.Equal(0, await DriverAccountLinker.LinkUnambiguousAsync(db, logger));

        Assert.All(db.Drivers, d => Assert.Null(d.UserId));
        var warning = Assert.Single(logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.DoesNotContain(Phone, warning.Message);
    }

    [Fact]
    public async Task SkipsAmbiguousMatches_TwoDriverAccountsOnePhone()
    {
        using var db = TestDbContextFactory.Create();
        AddUser(db, "Account One", Phone);
        AddUser(db, "Account Two", Phone);
        AddDriver(db, "Only Record", Phone);
        await db.SaveChangesAsync();

        Assert.Equal(0, await DriverAccountLinker.LinkUnambiguousAsync(db));

        Assert.Null((await db.Drivers.SingleAsync()).UserId);
    }

    [Fact]
    public async Task SkipsWhenAnotherDriverWithTheSamePhoneIsAlreadyLinked()
    {
        using var db = TestDbContextFactory.Create();
        var owner = AddUser(db, "Owner", "+94770009999");
        AddDriver(db, "Linked Record", Phone, owner);
        AddUser(db, "Newcomer", Phone);
        var unlinked = AddDriver(db, "Unlinked Record", Phone);
        await db.SaveChangesAsync();

        Assert.Equal(0, await DriverAccountLinker.LinkUnambiguousAsync(db));

        Assert.Null((await db.Drivers.SingleAsync(d => d.Id == unlinked.Id)).UserId);
    }

    [Fact]
    public async Task NeverLinksByNameAlone()
    {
        using var db = TestDbContextFactory.Create();
        AddUser(db, "Same Name", "+94770002222");
        AddDriver(db, "Same Name", "+94770003333");
        await db.SaveChangesAsync();

        Assert.Equal(0, await DriverAccountLinker.LinkUnambiguousAsync(db));

        Assert.Null((await db.Drivers.SingleAsync()).UserId);
    }

    [Fact]
    public async Task IgnoresNonDriverAccounts_BlankNumbers_AndAlreadyLinkedAccounts()
    {
        using var db = TestDbContextFactory.Create();
        AddUser(db, "A Traveler", Phone, UserRole.Traveler);
        AddUser(db, "An Admin", "+94770004444", UserRole.Admin);
        var linkedUser = AddUser(db, "Linked Account", "+94770005555");
        AddDriver(db, "Phone Of Traveler", Phone);
        AddDriver(db, "Phone Of Admin", "+94770004444");
        AddDriver(db, "No Contact", "");
        AddDriver(db, "Already Linked", "+94770006666", linkedUser);
        // The linked account's number also sits on an unlinked record: never re-point the account.
        AddDriver(db, "Second Claim", "+94770005555");
        await db.SaveChangesAsync();

        Assert.Equal(0, await DriverAccountLinker.LinkUnambiguousAsync(db));

        Assert.Equal(1, await db.Drivers.CountAsync(d => d.UserId != null));
    }

    [Fact]
    public async Task IsIdempotent_AndLeavesExistingLinksAlone()
    {
        using var db = TestDbContextFactory.Create();
        var existing = AddUser(db, "Existing", "+94770007777");
        AddDriver(db, "Existing Record", "+94770007777", existing);
        var fresh = AddUser(db, "Fresh", Phone);
        var freshDriver = AddDriver(db, "Fresh Record", Phone);
        await db.SaveChangesAsync();

        Assert.Equal(1, await DriverAccountLinker.LinkUnambiguousAsync(db));
        Assert.Equal(0, await DriverAccountLinker.LinkUnambiguousAsync(db));

        Assert.Equal(fresh.Id, (await db.Drivers.SingleAsync(d => d.Id == freshDriver.Id)).UserId);
        Assert.Equal(2, await db.Drivers.CountAsync(d => d.UserId != null));
    }

    [Fact]
    public async Task SeedAsync_RunsTheLinker_ButNoLongerLinksTheDemoDriverByName()
    {
        using var db = TestDbContextFactory.Create();
        var options = Options.Create(new AdminSeedOptions());
        await DbSeeder.SeedAsync(db, options);

        // An unlinked record whose number belongs to a new, unambiguous Driver account gets linked on the next start.
        var user = AddUser(db, "New Driver", "+94770008888");
        var driver = AddDriver(db, "Someone Else Entirely", "+94770008888");
        // A same-name record with a different number must stay unlinked.
        var namesakeUser = AddUser(db, "Namesake Name", "+94770001234");
        var namesakeDriver = AddDriver(db, "Namesake Name", "+94770004321");
        await db.SaveChangesAsync();

        await DbSeeder.SeedAsync(db, options);

        Assert.Equal(user.Id, (await db.Drivers.SingleAsync(d => d.Id == driver.Id)).UserId);
        Assert.Null((await db.Drivers.SingleAsync(d => d.Id == namesakeDriver.Id)).UserId);
        Assert.NotEqual(Guid.Empty, namesakeUser.Id);
    }

    [Fact]
    public async Task SeedAsync_DoesNotRepointTheDemoDriverAwayFromAnotherAccount()
    {
        using var db = TestDbContextFactory.Create();
        var options = Options.Create(new AdminSeedOptions());
        await DbSeeder.SeedAsync(db, options);
        var demoDriver = await db.Drivers.SingleAsync(d => d.Name == "Sunil Jayawardena");
        var someoneElse = AddUser(db, "Someone Else", "+94770009090");
        demoDriver.UserId = someoneElse.Id;
        await db.SaveChangesAsync();

        await DbSeeder.SeedAsync(db, options);

        Assert.Equal(someoneElse.Id, (await db.Drivers.SingleAsync(d => d.Id == demoDriver.Id)).UserId);
    }

    private static User AddUser(TrailWiseDbContext db, string name, string phone, UserRole role = UserRole.Driver)
    {
        var user = new User
        {
            Name = name,
            Email = $"u-{Guid.NewGuid():N}@example.com",
            ContactNumber = phone,
            PasswordHash = "irrelevant",
            Role = role
        };
        db.Users.Add(user);
        return user;
    }

    private static Driver AddDriver(TrailWiseDbContext db, string name, string phone, User? user = null)
    {
        var driver = new Driver
        {
            Name = name,
            LicenseNumber = $"L-{Guid.NewGuid():N}"[..12],
            ContactInfo = phone,
            User = user
        };
        db.Drivers.Add(driver);
        return driver;
    }

    private sealed class CollectingLogger : ILogger
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = new();

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Entries.Add((logLevel, formatter(state, exception)));
    }
}
