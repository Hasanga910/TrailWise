using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Discounts;
using Xunit;

namespace TrailWise.Api.Tests;

public class DiscountsEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public DiscountsEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Create_AsOperationsManager_ReturnsCreated()
    {
        var managerClient = await AuthenticatedOperationsManagerAsync();

        var response = await managerClient.PostAsJsonAsync("/api/discounts", new
        {
            Description = $"Test discount {Guid.NewGuid():N}",
            PercentageOff = 12.5m,
            MinGroupSize = 8
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.Equal(12.5m, created!.PercentageOff);
        Assert.Equal(8, created.MinGroupSize);
    }

    [Fact]
    public async Task Create_WithInvalidPercentage_ReturnsBadRequest()
    {
        var managerClient = await AuthenticatedOperationsManagerAsync();

        var response = await managerClient.PostAsJsonAsync("/api/discounts", new
        {
            Description = "Invalid discount",
            PercentageOff = 0m,
            MinGroupSize = 5
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithTravelerToken_ReturnsForbidden()
    {
        var travelerClient = await AuthenticatedTravelerAsync();

        var response = await travelerClient.PostAsJsonAsync("/api/discounts", new
        {
            Description = "Traveler attempt",
            PercentageOff = 10m,
            MinGroupSize = 5
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Create_AsAnonymous_ReturnsUnauthorized()
    {
        var anonymousClient = _factory.CreateClient();

        var response = await anonymousClient.PostAsJsonAsync("/api/discounts", new
        {
            Description = "Anonymous attempt",
            PercentageOff = 10m,
            MinGroupSize = 5
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetAll_AsOperationsManager_ReturnsCreatedDiscount()
    {
        var managerClient = await AuthenticatedOperationsManagerAsync();
        var description = $"GetAll test discount {Guid.NewGuid():N}";

        await managerClient.PostAsJsonAsync("/api/discounts", new
        {
            Description = description,
            PercentageOff = 20m,
            MinGroupSize = 12
        });

        var response = await managerClient.GetAsync("/api/discounts");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var discounts = await response.Content.ReadFromJsonAsync<List<DiscountDto>>(JsonOptions);
        Assert.Contains(discounts!, d => d.Description == description);
    }

    [Fact]
    public async Task GetAll_WithTravelerToken_ReturnsForbidden()
    {
        var travelerClient = await AuthenticatedTravelerAsync();

        var response = await travelerClient.GetAsync("/api/discounts");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Delete_AsOperationsManager_RemovesDiscount()
    {
        var managerClient = await AuthenticatedOperationsManagerAsync();
        var createResponse = await managerClient.PostAsJsonAsync("/api/discounts", new
        {
            Description = $"Delete-me discount {Guid.NewGuid():N}",
            PercentageOff = 5m,
            MinGroupSize = 4
        });
        var created = await createResponse.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);

        var deleteResponse = await managerClient.DeleteAsync($"/api/discounts/{created!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getAllResponse = await managerClient.GetAsync("/api/discounts");
        var discounts = await getAllResponse.Content.ReadFromJsonAsync<List<DiscountDto>>(JsonOptions);
        Assert.DoesNotContain(discounts!, d => d.Id == created.Id);
    }

    [Fact]
    public async Task Delete_WithNonexistentId_ReturnsNotFound()
    {
        var managerClient = await AuthenticatedOperationsManagerAsync();

        var response = await managerClient.DeleteAsync($"/api/discounts/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<HttpClient> AuthenticatedTravelerAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Traveler D", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<HttpClient> AuthenticatedOperationsManagerAsync()
    {
        var client = _factory.CreateClient();
        var adminLoginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var adminAuth = await adminLoginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        using var adminRequest = new HttpRequestMessage(HttpMethod.Post, "/api/auth/admin/users")
        {
            Headers = { Authorization = new AuthenticationHeaderValue("Bearer", adminAuth!.Token) },
            Content = JsonContent.Create(new
            {
                Name = "Ops Manager",
                Email = $"ops-{Guid.NewGuid():N}@example.com",
                Password = "P@ssword123",
                ContactNumber = "+14155550101",
                Role = "OperationsManager"
            })
        };
        var createResponse = await client.SendAsync(adminRequest);
        createResponse.EnsureSuccessStatusCode();
        var createdUser = await createResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = createdUser!.Email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
