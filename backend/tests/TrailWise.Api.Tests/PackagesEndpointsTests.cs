using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Packages;
using Xunit;

namespace TrailWise.Api.Tests;

public class PackagesEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public PackagesEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Create_WithTravelerToken_ReturnsForbidden()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "T", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.PostAsJsonAsync("/api/packages", NewPackagePayload());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithOperationsManagerToken_ReturnsCreated()
    {
        var client = _factory.CreateClient();
        var opsManagerEmail = await CreateOperationsManagerAsync(client);

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = opsManagerEmail, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.PostAsJsonAsync("/api/packages", NewPackagePayload());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        Assert.Equal("Integration Test Package", created!.Name);
        Assert.Single(created.Tiers);
    }

    [Fact]
    public async Task AddTier_ToExistingPackage_ReturnsUpdatedPackageWithNewTier()
    {
        var client = _factory.CreateClient();
        var opsManagerEmail = await CreateOperationsManagerAsync(client);
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = opsManagerEmail, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);

        var createResponse = await client.PostAsJsonAsync("/api/packages", NewPackagePayload());
        var created = await createResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);

        var addTierResponse = await client.PostAsJsonAsync($"/api/packages/{created!.Id}/tiers", new
        {
            ClassType = "First",
            IncludesFood = true,
            BasePricePerPerson = 260m,
            RequiresAC = true
        });

        Assert.Equal(HttpStatusCode.OK, addTierResponse.StatusCode);
        var updated = await addTierResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        Assert.Equal(2, updated!.Tiers.Count);
        Assert.Contains(updated.Tiers, t => t.ClassType.ToString() == "First" && t.RequiresAC);
    }

    [Fact]
    public async Task DeleteWithoutBookings_ReturnsNoContent()
    {
        var client = _factory.CreateClient();
        var opsManagerEmail = await CreateOperationsManagerAsync(client);
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = opsManagerEmail, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);

        var createResponse = await client.PostAsJsonAsync("/api/packages", NewPackagePayload());
        var created = await createResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);

        var deleteResponse = await client.DeleteAsync($"/api/packages/{created!.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    private static object NewPackagePayload() => new
    {
        Name = "Integration Test Package",
        Theme = "Testing",
        DurationDays = 2,
        BasePricePerPerson = 100m,
        MaxGroupSize = 10,
        Tiers = new[]
        {
            new { ClassType = "Normal", IncludesFood = false, BasePricePerPerson = 100m, RequiresAC = false }
        },
        LocationNames = new[] { "Galle" }
    };

    private static async Task<string> CreateOperationsManagerAsync(HttpClient client)
    {
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
        var response = await client.SendAsync(adminRequest);
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<UserDto>(JsonOptions);
        return created!.Email;
    }
}
