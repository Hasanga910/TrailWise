using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Packages;
using Xunit;

namespace TrailWise.Api.Tests;

/// <summary>Anonymous browsing of the package catalogue: filters, sorting, facets and guards.</summary>
public class PublicPackagesEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;
    private static readonly SemaphoreSlim SeedLock = new(1, 1);
    private static bool _seeded;

    public PublicPackagesEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // ---- guards -------------------------------------------------------------------------

    [Fact]
    public async Task GetAll_Anonymous_ReturnsOk()
    {
        await SeedAsync();
        var response = await _factory.CreateClient().GetAsync("/api/packages");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(4, (await ReadAsync(response)).Count);
    }

    [Fact]
    public async Task GetById_Anonymous_ReturnsOkAndUnknownIdIsNotFound()
    {
        await SeedAsync();
        var client = _factory.CreateClient();
        var first = (await ReadAsync(await client.GetAsync("/api/packages")))[0];

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/packages/{first.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/packages/{Guid.NewGuid()}")).StatusCode);
    }

    [Fact]
    public async Task WriteEndpoints_Anonymous_AreStillUnauthorized()
    {
        await SeedAsync();
        var client = _factory.CreateClient();
        var id = (await ReadAsync(await client.GetAsync("/api/packages")))[0].Id;

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/packages", Payload("X", "T", 1, 10, ("Normal", false, false, 10m), "A"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.DeleteAsync($"/api/packages/{id}")).StatusCode);
    }

    // ---- filters ------------------------------------------------------------------------

    [Theory]
    [InlineData("hill", "Hill Country Escape")]
    [InlineData("CULTURAL", "Cultural Triangle")]
    [InlineData("mirissa", "Southern Coast")]
    [InlineData("culture", "Hill Country Escape,Cultural Triangle")]
    public async Task Q_MatchesNameThemeOrLocation_CaseInsensitively(string q, string expectedNames)
    {
        await SeedAsync();
        var result = await QueryAsync($"q={q}&sort=name");
        Assert.Equal(expectedNames.Split(',').OrderBy(n => n), result.Select(p => p.Name));
    }

    [Fact]
    public async Task Theme_FiltersExactlyAndCaseInsensitively()
    {
        await SeedAsync();
        Assert.Equal(new[] { "Cultural Triangle", "Hill Country Escape" }, (await QueryAsync("theme=culture&sort=name")).Select(p => p.Name));
    }

    [Fact]
    public async Task DurationRange_FiltersInclusively()
    {
        await SeedAsync();
        Assert.Equal(new[] { "Hill Country Escape", "Southern Coast" }, (await QueryAsync("minDays=3&maxDays=5&sort=name")).Select(p => p.Name));
    }

    [Fact]
    public async Task Guests_ExcludesPackagesThatCannotFitTheGroup()
    {
        await SeedAsync();
        Assert.Equal(new[] { "Hill Country Escape", "Southern Coast" }, (await QueryAsync("guests=8&sort=name")).Select(p => p.Name));
    }

    [Fact]
    public async Task PriceRange_MatchesAnyTierInRange()
    {
        await SeedAsync();
        Assert.Equal(new[] { "Hill Country Escape" }, (await QueryAsync("minPrice=250")).Select(p => p.Name));
        Assert.Equal(new[] { "Safari Special" }, (await QueryAsync("maxPrice=90")).Select(p => p.Name));
    }

    [Fact]
    public async Task TierFilters_ClassFoodAndAc()
    {
        await SeedAsync();
        Assert.Equal(new[] { "Hill Country Escape" }, (await QueryAsync("classType=First")).Select(p => p.Name));
        Assert.Equal(new[] { "Cultural Triangle", "Hill Country Escape" }, (await QueryAsync("includesFood=true&sort=name")).Select(p => p.Name));
        Assert.Equal(new[] { "Hill Country Escape" }, (await QueryAsync("requiresAC=true")).Select(p => p.Name));
    }

    [Fact]
    public async Task TierFilters_MustAllBeSatisfiedByTheSameTier()
    {
        await SeedAsync();
        // Hill Country has a cheap Normal tier (no food) and a pricey First tier (food): no single tier is food AND under 150.
        Assert.DoesNotContain(await QueryAsync("includesFood=true&maxPrice=150"), p => p.Name == "Hill Country Escape");
    }

    [Fact]
    public async Task MinRating_ExcludesUnreviewedPackages()
    {
        await SeedAsync();
        Assert.Empty(await QueryAsync("minRating=1"));
    }

    // ---- sorting ------------------------------------------------------------------------

    [Fact]
    public async Task NoSortParameter_ReturnsEverythingInNaturalOrder()
    {
        await SeedAsync();
        // Order is deliberately unspecified so existing callers (mobile, traveler pages) see no change.
        Assert.Equal(
            new[] { "Cultural Triangle", "Hill Country Escape", "Safari Special", "Southern Coast" },
            (await QueryAsync("")).Select(p => p.Name).OrderBy(n => n));
    }

    [Fact]
    public async Task Sort_ByName_BothDirections()
    {
        await SeedAsync();
        Assert.Equal(new[] { "Cultural Triangle", "Hill Country Escape", "Safari Special", "Southern Coast" }, (await QueryAsync("sort=name")).Select(p => p.Name));
        Assert.Equal(new[] { "Southern Coast", "Safari Special", "Hill Country Escape", "Cultural Triangle" }, (await QueryAsync("sort=name&dir=desc")).Select(p => p.Name));
    }

    [Fact]
    public async Task Sort_ByPrice_UsesStartingPrice()
    {
        await SeedAsync();
        Assert.Equal(new[] { "Safari Special", "Hill Country Escape", "Southern Coast", "Cultural Triangle" }, (await QueryAsync("sort=price")).Select(p => p.Name));
        Assert.Equal(new[] { "Cultural Triangle", "Southern Coast", "Hill Country Escape", "Safari Special" }, (await QueryAsync("sort=price&dir=desc")).Select(p => p.Name));
    }

    [Fact]
    public async Task Sort_ByPrice_WithTierFilter_UsesTheMatchingTierPrice()
    {
        await SeedAsync();
        var result = await QueryAsync("sort=price&classType=Normal");
        // Normal tiers: Safari 80, Hill 100, Southern 150 (Cultural has only Second).
        Assert.Equal(new[] { "Safari Special", "Hill Country Escape", "Southern Coast" }, result.Select(p => p.Name));
    }

    [Fact]
    public async Task Sort_ByDuration_BothDirections()
    {
        await SeedAsync();
        Assert.Equal(new[] { "Safari Special", "Hill Country Escape", "Southern Coast", "Cultural Triangle" }, (await QueryAsync("sort=duration")).Select(p => p.Name));
        Assert.Equal(new[] { "Cultural Triangle", "Southern Coast", "Hill Country Escape", "Safari Special" }, (await QueryAsync("sort=duration&dir=desc")).Select(p => p.Name));
    }

    [Fact]
    public async Task Sort_ByRating_IsStableByNameWhenNoReviews()
    {
        await SeedAsync();
        Assert.Equal(new[] { "Cultural Triangle", "Hill Country Escape", "Safari Special", "Southern Coast" }, (await QueryAsync("sort=rating")).Select(p => p.Name));
    }

    [Fact]
    public async Task Sort_IsCaseInsensitive()
    {
        await SeedAsync();
        Assert.Equal(HttpStatusCode.OK, (await _factory.CreateClient().GetAsync("/api/packages?sort=PRICE&dir=DESC")).StatusCode);
    }

    // ---- validation ---------------------------------------------------------------------

    [Theory]
    [InlineData("sort=banana")]
    [InlineData("dir=sideways")]
    [InlineData("classType=Platinum")]
    [InlineData("minPrice=500&maxPrice=100")]
    [InlineData("minDays=9&maxDays=2")]
    public async Task InvalidQuery_ReturnsBadRequest(string query)
    {
        await SeedAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await _factory.CreateClient().GetAsync($"/api/packages?{query}")).StatusCode);
    }

    // ---- DTO additions ------------------------------------------------------------------

    [Fact]
    public async Task StartingPrice_IsLowestTierPrice_AndLocationsExposeCoordinates()
    {
        await SeedAsync();
        var hill = (await QueryAsync("q=hill")).Single();

        Assert.Equal(100m, hill.StartingPrice);
        Assert.Equal(2, hill.Locations.Count);
        // Geocoded on save (fake Nominatim knows Kandy and Ella).
        Assert.All(hill.Locations, l =>
        {
            Assert.NotNull(l.Latitude);
            Assert.NotNull(l.Longitude);
        });
    }

    // ---- facets -------------------------------------------------------------------------

    [Fact]
    public async Task Facets_Anonymous_ReturnsThemesAndBounds()
    {
        await SeedAsync();
        var facets = await _factory.CreateClient().GetFromJsonAsync<PackageFacetsDto>("/api/packages/facets", JsonOptions);

        Assert.Equal(new[] { "Beach", "Culture", "Wildlife" }, facets!.Themes);
        Assert.Equal(80m, facets.MinPrice);
        Assert.Equal(300m, facets.MaxPrice);
        Assert.Equal(2, facets.MinDays);
        Assert.Equal(7, facets.MaxDays);
        Assert.Equal(20, facets.MaxGroupSize);
    }

    [Fact]
    public async Task Facets_WithEmptyCatalogue_ReturnsZeros()
    {
        using var empty = new TrailWiseWebApplicationFactory();
        await ClearPackagesAsync(await AdminClientAsync(empty));
        var facets = await empty.CreateClient().GetFromJsonAsync<PackageFacetsDto>("/api/packages/facets", JsonOptions);

        Assert.Empty(facets!.Themes);
        Assert.Equal(0m, facets.MaxPrice);
    }

    // ---- helpers ------------------------------------------------------------------------

    private async Task<List<TourPackageDto>> QueryAsync(string query)
    {
        var response = await _factory.CreateClient().GetAsync($"/api/packages?{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync(response);
    }

    private static async Task<List<TourPackageDto>> ReadAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<List<TourPackageDto>>(JsonOptions))!;

    private async Task SeedAsync()
    {
        await SeedLock.WaitAsync();
        try
        {
            if (_seeded) return;
            var client = await AdminClientAsync(_factory);

            await ClearPackagesAsync(client);

            foreach (var payload in new[]
            {
                Payload("Hill Country Escape", "Culture", 3, 10, new[] { ("Normal", false, false, 100m), ("First", true, true, 300m) }, "Kandy", "Ella"),
                Payload("Southern Coast", "Beach", 5, 20, ("Normal", false, false, 150m), "Galle", "Mirissa"),
                Payload("Cultural Triangle", "Culture", 7, 6, ("Second", true, false, 200m), "Sigiriya"),
                Payload("Safari Special", "Wildlife", 2, 4, ("Normal", false, false, 80m), "Yala")
            })
            {
                Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/packages", payload)).StatusCode);
            }
            _seeded = true;
        }
        finally
        {
            SeedLock.Release();
        }
    }

    private static async Task<HttpClient> AdminClientAsync(TrailWiseWebApplicationFactory factory)
    {
        var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var auth = await login.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    /// <summary>The app seeds sample packages on startup; remove them so assertions see only the test data.</summary>
    private static async Task ClearPackagesAsync(HttpClient admin)
    {
        var existing = await admin.GetFromJsonAsync<List<TourPackageDto>>("/api/packages", JsonOptions);
        foreach (var package in existing!)
            Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/packages/{package.Id}")).StatusCode);
    }

    private static object Payload(string name, string theme, int days, int maxGroup, (string Class, bool Food, bool Ac, decimal Price) tier, params string[] locations) =>
        Payload(name, theme, days, maxGroup, new[] { tier }, locations);

    private static object Payload(string name, string theme, int days, int maxGroup, (string Class, bool Food, bool Ac, decimal Price)[] tiers, params string[] locations) => new
    {
        Name = name,
        Theme = theme,
        DurationDays = days,
        BasePricePerPerson = tiers.Min(t => t.Price),
        MaxGroupSize = maxGroup,
        Tiers = tiers.Select(t => new { ClassType = t.Class, IncludesFood = t.Food, BasePricePerPerson = t.Price, RequiresAC = t.Ac }).ToArray(),
        LocationNames = locations
    };
}
