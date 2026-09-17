using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TrailWise.Api.Contracts.Auth;
using Xunit;

namespace TrailWise.Api.Tests;

public class StaffEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public StaffEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetStaff_WithTravelerToken_ReturnsForbidden()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync("/api/auth/register", new { Name = "T", Email = email, Password = "P@ssword123" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);

        var response = await client.GetAsync("/api/auth/admin/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetStaff_WithAdminToken_ExcludesTravelersIncludesCreatedStaff()
    {
        var client = await AdminClientAsync();
        var guideEmail = $"guide-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "New Guide",
            Email = guideEmail,
            Password = "P@ssword123",
            Role = "TourGuide"
        });

        var response = await client.GetAsync("/api/auth/admin/users");
        response.EnsureSuccessStatusCode();
        var staff = await response.Content.ReadFromJsonAsync<List<UserDto>>(JsonOptions);

        Assert.Contains(staff!, u => u.Email == guideEmail && u.Role.ToString() == "TourGuide");
        Assert.DoesNotContain(staff!, u => u.Role.ToString() == "Traveler");
    }

    [Fact]
    public async Task DeleteUser_RemovesStaffAccount()
    {
        var client = await AdminClientAsync();
        var guideEmail = $"guide-{Guid.NewGuid():N}@example.com";
        var createResponse = await client.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Removable Guide",
            Email = guideEmail,
            Password = "P@ssword123",
            Role = "TourGuide"
        });
        var created = await createResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);

        var deleteResponse = await client.DeleteAsync($"/api/auth/admin/users/{created!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var listResponse = await client.GetAsync("/api/auth/admin/users");
        var staff = await listResponse.Content.ReadFromJsonAsync<List<UserDto>>(JsonOptions);
        Assert.DoesNotContain(staff!, u => u.Id == created.Id);
    }

    [Fact]
    public async Task DeleteUser_OwnAccount_ReturnsConflict()
    {
        var client = await AdminClientAsync();
        var meResponse = await client.GetAsync("/api/auth/me");
        var me = await meResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);

        var response = await client.DeleteAsync($"/api/auth/admin/users/{me!.Id}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    private async Task<HttpClient> AdminClientAsync()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
