using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Packages;
using Xunit;

namespace TrailWise.Api.Tests;

public class BookingsEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public BookingsEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Create_WithValidRequest_ReturnsCreated()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        var response = await client.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = tier.Id,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(33)),
            BudgetPerPerson = 500m
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Requested", created!.Status.ToString());
    }

    [Fact]
    public async Task Create_WithZeroGroupSize_ReturnsStructuredFieldError()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        var response = await client.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = tier.Id,
            GroupSize = 0,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(33)),
            BudgetPerPerson = 500m
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var errors = body.GetProperty("errors");
        Assert.Contains(errors.EnumerateArray(), e => e.GetProperty("field").GetString() == "groupSize");
    }

    [Fact]
    public async Task Create_WithPastStartDate_ReturnsStructuredFieldError()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        var response = await client.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = tier.Id,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)),
            BudgetPerPerson = 500m
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var errors = body.GetProperty("errors");
        Assert.Contains(errors.EnumerateArray(), e => e.GetProperty("field").GetString() == "startDate");
    }

    [Fact]
    public async Task Create_WithZeroBudget_ReturnsStructuredFieldError()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        var response = await client.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = tier.Id,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(33)),
            BudgetPerPerson = 0m
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var errors = body.GetProperty("errors");
        Assert.Contains(errors.EnumerateArray(), e => e.GetProperty("field").GetString() == "budgetPerPerson");
    }

    [Fact]
    public async Task Create_WithLargeGroup_RemainsRequestedAndFlagsIsLargeGroup()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client); // Cultural Triangle Explorer, MaxGroupSize = 12

        var response = await client.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = tier.Id,
            GroupSize = 11,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(33)),
            BudgetPerPerson = 500m
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Requested", created!.Status.ToString());
        Assert.True(created.IsLargeGroup);
    }

    [Fact]
    public async Task GetMine_WithNoParams_ReturnsPagedEnvelopeWithDefaults()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        await CreateBookingAsync(client, tier.Id, startDaysFromNow: 10);
        await CreateBookingAsync(client, tier.Id, startDaysFromNow: 20);

        var result = await client.GetFromJsonAsync<PagedResult<BookingDto>>("/api/bookings/mine", JsonOptions);

        Assert.NotNull(result);
        Assert.Equal(2, result!.TotalCount);
        Assert.Equal(1, result.Page);
        Assert.Equal(10, result.PageSize);
        Assert.Equal(2, result.Items.Count);
    }

    [Fact]
    public async Task GetMine_FiltersByStatus()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);
        await CreateBookingAsync(client, tier.Id, startDaysFromNow: 10);

        // No endpoint transitions a booking's status yet, so every seeded booking stays
        // Requested — this test only exercises the "excludes non-matching status" path.
        var result = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?status=PlanProposed", JsonOptions);

        Assert.NotNull(result);
        Assert.Equal(0, result!.TotalCount);
        Assert.Empty(result.Items);
    }

    [Fact]
    public async Task GetMine_FiltersByDateRange()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);
        await CreateBookingAsync(client, tier.Id, startDaysFromNow: 40);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var including = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            $"/api/bookings/mine?from={today.AddDays(35):yyyy-MM-dd}&to={today.AddDays(45):yyyy-MM-dd}", JsonOptions);
        var excluding = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            $"/api/bookings/mine?from={today.AddDays(1):yyyy-MM-dd}&to={today.AddDays(5):yyyy-MM-dd}", JsonOptions);

        Assert.Equal(1, including!.TotalCount);
        Assert.Equal(0, excluding!.TotalCount);
    }

    [Fact]
    public async Task GetMine_PaginatesResults()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);
        await CreateBookingAsync(client, tier.Id, startDaysFromNow: 5);
        await CreateBookingAsync(client, tier.Id, startDaysFromNow: 6);
        await CreateBookingAsync(client, tier.Id, startDaysFromNow: 7);

        var pageOne = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?pageSize=2&page=1", JsonOptions);
        var pageTwo = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?pageSize=2&page=2", JsonOptions);

        Assert.Equal(2, pageOne!.Items.Count);
        Assert.Equal(3, pageOne.TotalCount);
        Assert.Single(pageTwo!.Items);
        Assert.Equal(3, pageTwo.TotalCount);
    }

    [Fact]
    public async Task GetMine_ClampsOversizedPageSize()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);
        await CreateBookingAsync(client, tier.Id, startDaysFromNow: 5);

        var result = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?pageSize=500", JsonOptions);

        Assert.Equal(50, result!.PageSize);
        Assert.True(result.Items.Count <= 50);
    }

    [Fact]
    public async Task GetMine_WithFromAfterTo_ReturnsFieldValidationError()
    {
        var client = await AuthenticatedTravelerAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var response = await client.GetAsync(
            $"/api/bookings/mine?from={today.AddDays(10):yyyy-MM-dd}&to={today.AddDays(5):yyyy-MM-dd}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var errors = body.GetProperty("errors");
        Assert.Contains(errors.EnumerateArray(), e => e.GetProperty("field").GetString() == "to");
    }

    [Fact]
    public async Task GetMine_OnlyReturnsCallersOwnBookings()
    {
        var clientA = await AuthenticatedTravelerAsync();
        var clientB = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(clientA);

        await CreateBookingAsync(clientA, tier.Id, startDaysFromNow: 5);
        await CreateBookingAsync(clientB, tier.Id, startDaysFromNow: 6);

        var resultA = await clientA.GetFromJsonAsync<PagedResult<BookingDto>>("/api/bookings/mine", JsonOptions);

        Assert.Equal(1, resultA!.TotalCount);
    }

    private static async Task CreateBookingAsync(HttpClient client, Guid packageTierId, int startDaysFromNow)
    {
        var response = await client.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = packageTierId,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(startDaysFromNow)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(startDaysFromNow + 3)),
            BudgetPerPerson = 500m
        });
        response.EnsureSuccessStatusCode();
    }

    private async Task<HttpClient> AuthenticatedTravelerAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "T", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private static async Task<PackageTierDto> GetFirstTierAsync(HttpClient client)
    {
        var packages = await client.GetFromJsonAsync<List<TourPackageDto>>("/api/packages", JsonOptions);
        return packages!.First(p => p.Tiers.Count > 0).Tiers.First();
    }
}
