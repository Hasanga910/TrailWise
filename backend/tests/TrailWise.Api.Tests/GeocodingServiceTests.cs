using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class GeocodingServiceTests
{
    private sealed class RecordingDelay : IGeocodingDelay
    {
        public List<TimeSpan> Delays { get; } = new();
        public Task DelayAsync(TimeSpan delay, CancellationToken ct)
        {
            Delays.Add(delay);
            return Task.CompletedTask;
        }
    }

    private sealed class ScriptedSearch : ILocationSearchService
    {
        private readonly Func<string, IReadOnlyList<LocationSuggestion>> _script;
        public List<string> Queries { get; } = new();
        public ScriptedSearch(Func<string, IReadOnlyList<LocationSuggestion>> script) => _script = script;
        public Task<IReadOnlyList<LocationSuggestion>> SearchAsync(string query, CancellationToken ct = default)
        {
            Queries.Add(query);
            return Task.FromResult(_script(query));
        }
    }

    private sealed class ThrowingSearch : ILocationSearchService
    {
        public Task<IReadOnlyList<LocationSuggestion>> SearchAsync(string query, CancellationToken ct = default) =>
            throw new InvalidOperationException("boom");
    }

    private static GeocodingThrottle Throttle(int delayMs = 0, IGeocodingDelay? delayer = null) =>
        new(Options.Create(new GeocodingOptions { DelayBetweenRequestsMs = delayMs }), delayer ?? new RecordingDelay());

    private static PackageLocationGeocoder Geocoder(ILocationSearchService search, GeocodingThrottle? throttle = null) =>
        new(search, throttle ?? Throttle(), NullLogger<PackageLocationGeocoder>.Instance);

    private static LocationSuggestion Suggestion(string name, double? lat = 7.0, double? lon = 80.0) => new(name, lat, lon);

    // ---- geocoder -----------------------------------------------------------------------

    [Fact]
    public async Task Lookup_ReturnsTopSuggestion_WhenNameMatchesFirstWord()
    {
        var geocoder = Geocoder(new ScriptedSearch(_ => new[] { Suggestion("Nuwara Eliya, Central Province, Sri Lanka", 6.95, 80.78) }));
        var point = await geocoder.LookupAsync("Nuwara Eliya", default);

        Assert.Equal(new GeocodedPoint(6.95, 80.78), point);
    }

    [Fact]
    public async Task Lookup_MatchesFirstWordCaseInsensitively()
    {
        var geocoder = Geocoder(new ScriptedSearch(_ => new[] { Suggestion("KANDY, Central", 7.29, 80.63) }));
        Assert.NotNull(await geocoder.LookupAsync("kandy", default));
    }

    [Fact]
    public async Task Lookup_ReturnsNull_WhenNothingFound()
    {
        var geocoder = Geocoder(new ScriptedSearch(_ => Array.Empty<LocationSuggestion>()));
        Assert.Null(await geocoder.LookupAsync("Atlantis", default));
    }

    [Fact]
    public async Task Lookup_RejectsASuggestionWhoseNameDoesNotContainTheQuery()
    {
        var geocoder = Geocoder(new ScriptedSearch(_ => new[] { Suggestion("Totally Different Place") }));
        Assert.Null(await geocoder.LookupAsync("Wellawatte", default));
    }

    [Fact]
    public async Task Lookup_RejectsASuggestionWithoutCoordinates_AndDoesNotFallBackToTheSecondResult()
    {
        var geocoder = Geocoder(new ScriptedSearch(_ => new[]
        {
            Suggestion("Ella, no coordinates", null, null),
            Suggestion("Ella, second best", 6.8, 81.0)
        }));
        Assert.Null(await geocoder.LookupAsync("Ella", default));
    }

    [Fact]
    public async Task Lookup_SwallowsSearchFailures()
    {
        var geocoder = Geocoder(new ThrowingSearch());
        Assert.Null(await geocoder.LookupAsync("Ella", default));
    }

    [Fact]
    public async Task Lookup_DoesNotSwallowCancellation()
    {
        using var cts = new CancellationTokenSource();
        cts.Cancel();
        var geocoder = Geocoder(new ScriptedSearch(_ => Array.Empty<LocationSuggestion>()), Throttle(1100, new TaskGeocodingDelay()));
        // First call passes the gate (cancelled token is checked by the semaphore wait).
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => geocoder.LookupAsync("Ella", cts.Token));
    }

    // ---- throttle -----------------------------------------------------------------------

    [Fact]
    public async Task Throttle_SpacesConsecutiveRequestsByTheConfiguredGap()
    {
        var delay = new RecordingDelay();
        var throttle = Throttle(1100, delay);

        await throttle.WaitTurnAsync(default); // first request never waits
        await throttle.WaitTurnAsync(default);
        await throttle.WaitTurnAsync(default);

        Assert.Equal(2, delay.Delays.Count);
        Assert.All(delay.Delays, d => Assert.InRange(d, TimeSpan.FromMilliseconds(900), TimeSpan.FromMilliseconds(1100)));
    }

    [Fact]
    public async Task Throttle_WithZeroGap_NeverWaits()
    {
        var delay = new RecordingDelay();
        var throttle = Throttle(0, delay);
        for (var i = 0; i < 5; i++) await throttle.WaitTurnAsync(default);
        Assert.Empty(delay.Delays);
    }

    // ---- resolver -----------------------------------------------------------------------

    private static PackageLocation Loc(string name, double? lat = null, double? lon = null) =>
        new() { Name = name, Latitude = lat, Longitude = lon };

    [Fact]
    public async Task Resolver_NeverTouchesLocationsThatAlreadyHaveCoordinates()
    {
        await using var db = TestDbContextFactory.Create();
        var search = new ScriptedSearch(q => new[] { Suggestion($"{q}, Sri Lanka", 1.5, 2.5) });
        var resolver = new PackageLocationResolver(db, Geocoder(search));

        var manual = Loc("Kandy", 7.123, 80.456);
        var missing = Loc("Ella");
        var result = await resolver.ResolveAsync(new[] { manual, missing }, 10, default);

        Assert.Equal(7.123, manual.Latitude);
        Assert.Equal(80.456, manual.Longitude);
        Assert.Equal(1.5, missing.Latitude);
        Assert.Equal(1, result.Updated);
        Assert.Equal(new[] { "Ella" }, search.Queries);
    }

    [Fact]
    public async Task Resolver_LeavesUnfoundPlacesWithoutCoordinates_AndReportsThem()
    {
        await using var db = TestDbContextFactory.Create();
        var resolver = new PackageLocationResolver(db, Geocoder(new ScriptedSearch(_ => Array.Empty<LocationSuggestion>())));

        var atlantis = Loc("Atlantis");
        var result = await resolver.ResolveAsync(new[] { atlantis }, 10, default);

        Assert.Null(atlantis.Latitude);
        Assert.Null(atlantis.Longitude);
        Assert.Equal(new[] { "Atlantis" }, result.NotFound);
        Assert.Equal(0, result.Updated);
    }

    [Fact]
    public async Task Resolver_ReusesCoordinatesFromASameNamedLocation_WithoutLookingUp()
    {
        await using var db = TestDbContextFactory.Create();
        var package = new TourPackage { Name = "P", Theme = "T", DurationDays = 1, BasePricePerPerson = 1, MaxGroupSize = 1 };
        package.Locations.Add(Loc("Galle", 6.05, 80.22));
        db.TourPackages.Add(package);
        await db.SaveChangesAsync();

        var search = new ScriptedSearch(_ => Array.Empty<LocationSuggestion>());
        var resolver = new PackageLocationResolver(db, Geocoder(search));
        var fresh = Loc("  galle ");
        await resolver.ResolveAsync(new[] { fresh }, 10, default);

        Assert.Equal(6.05, fresh.Latitude);
        Assert.Empty(search.Queries);
    }

    [Fact]
    public async Task Resolver_LooksEachNameUpOnce_AndAppliesItToAllRowsWithThatName()
    {
        await using var db = TestDbContextFactory.Create();
        var search = new ScriptedSearch(q => new[] { Suggestion($"{q}, Sri Lanka", 6.0, 80.0) });
        var resolver = new PackageLocationResolver(db, Geocoder(search));

        var rows = new[] { Loc("Galle"), Loc("galle"), Loc("Ella") };
        var result = await resolver.ResolveAsync(rows, 10, default);

        Assert.Equal(2, search.Queries.Count);
        Assert.All(rows, r => Assert.NotNull(r.Latitude));
        Assert.Equal(3, result.Updated);
    }

    [Fact]
    public async Task Resolver_StopsAtTheLookupCap_AndReportsHowManyWereSkipped()
    {
        await using var db = TestDbContextFactory.Create();
        var search = new ScriptedSearch(q => new[] { Suggestion($"{q}, Sri Lanka", 6.0, 80.0) });
        var resolver = new PackageLocationResolver(db, Geocoder(search));

        var rows = new[] { Loc("Alpha"), Loc("Beta"), Loc("Gamma") };
        var result = await resolver.ResolveAsync(rows, 2, default);

        Assert.Equal(2, search.Queries.Count);
        Assert.Equal(2, result.Updated);
        Assert.Equal(1, result.SkippedForBudget);
        Assert.Null(rows[2].Latitude);
    }
}
