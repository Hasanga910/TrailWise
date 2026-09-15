using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Bookings;
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

    private async Task<HttpClient> AuthenticatedTravelerAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync("/api/auth/register", new { Name = "T", Email = email, Password = "P@ssword123" });
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
