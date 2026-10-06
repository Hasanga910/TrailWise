using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Packages;
using Xunit;

namespace TrailWise.Api.Tests;

/// <summary>Geocoding on save, manual coordinates, carry-over on update, and the admin backfill.</summary>
public class PackageCoordinatesEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;
    private FakeLocationSearchService Fake => _factory.Services.GetRequiredService<FakeLocationSearchService>();

    public PackageCoordinatesEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // ---- geocode on save ----------------------------------------------------------------

    [Fact]
    public async Task Create_GeocodesKnownLocations_AndLeavesUnfoundOnesOffTheMap()
    {
        Fake.Reset();
        var admin = await AdminAsync();

        var created = await CreateAsync(admin, "Geocode On Create", new[] { "Kandy", "Atlantis" });

        var kandy = created.Locations.Single(l => l.Name == "Kandy");
        Assert.Equal(7.2906, kandy.Latitude);
        Assert.Equal(80.6337, kandy.Longitude);
        var atlantis = created.Locations.Single(l => l.Name == "Atlantis");
        Assert.Null(atlantis.Latitude);
        Assert.Null(atlantis.Longitude);
    }

    [Fact]
    public async Task Create_RejectsAFuzzyMatchInsteadOfGuessing()
    {
        Fake.Reset();
        var created = await CreateAsync(await AdminAsync(), "Fuzzy Match", new[] { "Wellawatte" });

        Assert.Null(created.Locations.Single().Latitude);
    }

    [Fact]
    public async Task Create_StillSucceeds_WhenTheGeocoderIsOffline()
    {
        Fake.Reset();
        Fake.Offline = true;

        var created = await CreateAsync(await AdminAsync(), "Offline Geocoder", new[] { "Ella" });

        Assert.Equal("Offline Geocoder", created.Name);
        Assert.Null(created.Locations.Single().Latitude);
        Fake.Reset();
    }

    // ---- manual coordinates -------------------------------------------------------------

    [Fact]
    public async Task Create_WithManualCoordinates_SavesThemAndSkipsGeocodingForThatName()
    {
        Fake.Reset();
        var admin = await AdminAsync();

        var created = await CreateAsync(admin, "Manual Create", new[] { "Ella", "Mirissa" },
            coords: new[] { new { Name = "ella", Latitude = 6.5, Longitude = 81.5 } });

        var ella = created.Locations.Single(l => l.Name == "Ella");
        Assert.Equal(6.5, ella.Latitude);
        Assert.Equal(81.5, ella.Longitude);
        Assert.DoesNotContain("Ella", Fake.Queries);
        Assert.NotNull(created.Locations.Single(l => l.Name == "Mirissa").Latitude);
    }

    [Fact]
    public async Task Update_CarriesOverCoordinatesOfUnchangedNames_WithoutLookingThemUpAgain()
    {
        Fake.Reset();
        var admin = await AdminAsync();
        var created = await CreateAsync(admin, "Carry Over", new[] { "Kandy", "Galle" });
        Fake.Reset();

        var response = await admin.PutAsJsonAsync($"/api/packages/{created.Id}", UpdatePayload("Carry Over", new[] { "Kandy", "Galle", "Yala" }));
        var updated = (await response.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions))!;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(7.2906, updated.Locations.Single(l => l.Name == "Kandy").Latitude);
        Assert.Equal(6.0535, updated.Locations.Single(l => l.Name == "Galle").Latitude);
        Assert.NotNull(updated.Locations.Single(l => l.Name == "Yala").Latitude);
        Assert.Equal(new[] { "Yala" }, Fake.Queries); // only the new name was looked up
    }

    [Fact]
    public async Task Update_ManualCorrection_WinsOverGeocodedAndExistingValues_AndSurvivesLaterEdits()
    {
        Fake.Reset();
        var admin = await AdminAsync();
        var created = await CreateAsync(admin, "Manual Correction", new[] { "Kandy" });

        var corrected = await PutAsync(admin, created.Id, "Manual Correction", new[] { "Kandy" },
            new[] { new { Name = "Kandy", Latitude = 7.5, Longitude = 80.5 } });
        Assert.Equal(7.5, corrected.Locations.Single().Latitude);

        // A later edit that sends no coordinates keeps the manual value rather than re-geocoding it.
        Fake.Reset();
        var later = await PutAsync(admin, created.Id, "Manual Correction Renamed", new[] { "Kandy" }, null);
        Assert.Equal(7.5, later.Locations.Single().Latitude);
        Assert.Equal(80.5, later.Locations.Single().Longitude);
        Assert.Empty(Fake.Queries);
    }

    [Fact]
    public async Task Update_WithoutLocationCoordinates_StillWorksForOldClients()
    {
        Fake.Reset();
        var admin = await AdminAsync();
        var created = await CreateAsync(admin, "Old Client", new[] { "Galle" });

        var response = await admin.PutAsJsonAsync($"/api/packages/{created.Id}", UpdatePayload("Old Client 2", new[] { "Galle" }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ---- validation ---------------------------------------------------------------------

    [Fact]
    public async Task ManualCoordinates_AreValidated()
    {
        var admin = await AdminAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await PostRawAsync(admin, "V1", new[] { "Galle" }, new object[] { new { Name = "Galle", Latitude = 6.0 } })).StatusCode); // half pair
        Assert.Equal(HttpStatusCode.BadRequest, (await PostRawAsync(admin, "V2", new[] { "Galle" }, new object[] { new { Name = "Galle", Latitude = 91.0, Longitude = 80.0 } })).StatusCode); // latitude range
        Assert.Equal(HttpStatusCode.BadRequest, (await PostRawAsync(admin, "V3", new[] { "Galle" }, new object[] { new { Name = "Galle", Latitude = 6.0, Longitude = 181.0 } })).StatusCode); // longitude range
        Assert.Equal(HttpStatusCode.BadRequest, (await PostRawAsync(admin, "V4", new[] { "Galle" }, new object[] { new { Name = "Kandy", Latitude = 7.0, Longitude = 80.0 } })).StatusCode); // not in LocationNames
        Assert.Equal(HttpStatusCode.BadRequest, (await PostRawAsync(admin, "V5", new[] { "Galle" }, new object[]
        {
            new { Name = "Galle", Latitude = 6.0, Longitude = 80.0 },
            new { Name = "GALLE", Latitude = 6.1, Longitude = 80.1 }
        })).StatusCode); // duplicate
    }

    [Fact]
    public async Task ManualCoordinates_RequireManagerRole()
    {
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/packages", CreatePayload("Anon", new[] { "Galle" }, null));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ---- backfill -----------------------------------------------------------------------

    [Fact]
    public async Task GeocodeMissing_RequiresManagerRole()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().PostAsync("/api/packages/geocode-missing", null)).StatusCode);

        var traveler = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await traveler.PostAsJsonAsync("/api/auth/register", new { Name = "T", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });
        var login = await traveler.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        traveler.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", (await login.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions))!.Token);
        Assert.Equal(HttpStatusCode.Forbidden, (await traveler.PostAsync("/api/packages/geocode-missing", null)).StatusCode);
    }

    [Fact]
    public async Task GeocodeMissing_FillsExistingLocations_ReportsUnfound_AndNeverOverwritesManualOnes()
    {
        using var factory = new TrailWiseWebApplicationFactory();
        var fake = factory.Services.GetRequiredService<FakeLocationSearchService>();
        var admin = await AdminAsync(factory);
        await ClearPackagesAsync(factory);

        // Created while the geocoder is down, so everything starts without coordinates.
        fake.Offline = true;
        await CreateAsync(admin, "Backfill One", new[] { "Kandy", "Atlantis" }, factory: factory);
        await CreateAsync(admin, "Backfill Two", new[] { "Galle" }, factory: factory,
            coords: new[] { new { Name = "Galle", Latitude = 1.25, Longitude = 2.5 } });
        fake.Reset();

        var response = await admin.PostAsync("/api/packages/geocode-missing", null);
        var result = (await response.Content.ReadFromJsonAsync<GeocodeBackfillResultDto>(JsonOptions))!;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, result.Processed); // Atlantis + Kandy; Galle already had manual coordinates
        Assert.Equal(1, result.Updated);
        Assert.Equal(new[] { "Atlantis" }, result.NotFound);
        Assert.Equal(0, result.Remaining);
        Assert.Equal(1, result.NextSkip);
        Assert.DoesNotContain("Galle", fake.Queries);

        var packages = (await admin.GetFromJsonAsync<List<TourPackageDto>>("/api/packages", JsonOptions))!;
        var locations = packages.SelectMany(p => p.Locations).ToList();
        Assert.Equal(7.2906, locations.Single(l => l.Name == "Kandy").Latitude);
        Assert.Null(locations.Single(l => l.Name == "Atlantis").Latitude);
        Assert.Equal(1.25, locations.Single(l => l.Name == "Galle").Latitude); // manual value untouched
    }

    [Fact]
    public async Task GeocodeMissing_ProcessesInBatches_AndSkipsAlreadyTriedNames()
    {
        using var factory = new TrailWiseWebApplicationFactory();
        var admin = await AdminAsync(factory);
        await ClearPackagesAsync(factory);
        var fake = factory.Services.GetRequiredService<FakeLocationSearchService>();

        fake.Offline = true;
        // 30 unfindable names plus one findable one that sorts last.
        var names = Enumerable.Range(1, 30).Select(i => $"Nowhere{i:00}").Append("Yala").ToArray();
        await CreateAsync(admin, "Big Backfill", names, factory: factory);
        fake.Reset();

        var first = (await (await admin.PostAsync("/api/packages/geocode-missing", null)).Content.ReadFromJsonAsync<GeocodeBackfillResultDto>(JsonOptions))!;
        Assert.Equal(25, first.Processed);
        Assert.Equal(6, first.Remaining);
        Assert.Equal(25, first.NextSkip); // all 25 stayed unfound, so the next call must skip them

        var second = (await (await admin.PostAsync($"/api/packages/geocode-missing?skip={first.NextSkip}", null)).Content.ReadFromJsonAsync<GeocodeBackfillResultDto>(JsonOptions))!;
        Assert.Equal(6, second.Processed);
        Assert.Equal(1, second.Updated);
        Assert.Equal(0, second.Remaining);
    }

    // ---- helpers ------------------------------------------------------------------------

    private Task<HttpClient> AdminAsync() => AdminAsync(_factory);

    private static async Task<HttpClient> AdminAsync(TrailWiseWebApplicationFactory factory)
    {
        var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var auth = await login.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    /// <summary>
    /// Startup seeds sample packages. Remove them (and their locations: the in-memory provider does not
    /// cascade on its own) so backfill counts are exact.
    /// </summary>
    private static async Task ClearPackagesAsync(TrailWiseWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWise.Infrastructure.Persistence.TrailWiseDbContext>();
        db.PackageLocations.RemoveRange(db.PackageLocations);
        db.TourPackages.RemoveRange(db.TourPackages);
        await db.SaveChangesAsync();
    }

    private async Task<TourPackageDto> CreateAsync(HttpClient admin, string name, string[] locations, object? coords = null, TrailWiseWebApplicationFactory? factory = null)
    {
        var response = await admin.PostAsJsonAsync("/api/packages", CreatePayload(name, locations, coords));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions))!;
    }

    private static async Task<TourPackageDto> PutAsync(HttpClient admin, Guid id, string name, string[] locations, object? coords)
    {
        var response = await admin.PutAsJsonAsync($"/api/packages/{id}", UpdatePayload(name, locations, coords));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions))!;
    }

    private static Task<HttpResponseMessage> PostRawAsync(HttpClient admin, string name, string[] locations, object coords) =>
        admin.PostAsJsonAsync("/api/packages", CreatePayload(name, locations, coords));

    private static object CreatePayload(string name, string[] locations, object? coords) => new
    {
        Name = name,
        Theme = "Testing",
        DurationDays = 2,
        BasePricePerPerson = 100m,
        MaxGroupSize = 10,
        Tiers = new[] { new { ClassType = "Normal", IncludesFood = false, BasePricePerPerson = 100m, RequiresAC = false } },
        LocationNames = locations,
        LocationCoordinates = coords
    };

    private static object UpdatePayload(string name, string[] locations, object? coords = null) => new
    {
        Name = name,
        Theme = "Testing",
        DurationDays = 2,
        BasePricePerPerson = 100m,
        MaxGroupSize = 10,
        LocationNames = locations,
        LocationCoordinates = coords
    };
}
