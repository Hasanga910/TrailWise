using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TrailWise.Api.Contracts.Auth;
using Xunit;

namespace TrailWise.Api.Tests;

public class AuthEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public AuthEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Register_Login_Me_FullFlow_Succeeds()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";

        var registerResponse = await client.PostAsJsonAsync("/api/auth/register", new
        {
            Name = "Full Flow Traveler",
            Email = email,
            Password = "P@ssword123"
        });
        registerResponse.EnsureSuccessStatusCode();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var meResponse = await client.GetAsync("/api/auth/me");
        meResponse.EnsureSuccessStatusCode();
        var me = await meResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);

        Assert.Equal(email, me!.Email);
        Assert.Equal("Traveler", me.Role.ToString());
    }

    [Fact]
    public async Task Register_IgnoresClientSuppliedRole_AlwaysCreatesTraveler()
    {
        var client = _factory.CreateClient();
        var email = $"sneaky-{Guid.NewGuid():N}@example.com";

        // Attempt to smuggle a privileged role through the register payload; the DTO has
        // no Role property so this must be silently ignored, not bound.
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            Name = "Sneaky User",
            Email = email,
            Password = "P@ssword123",
            Role = "Admin"
        });
        response.EnsureSuccessStatusCode();

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        Assert.Equal("Traveler", auth!.User.Role.ToString());
    }

    [Fact]
    public async Task AdminCreateUser_WithoutToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Should Fail",
            Email = "should-fail@example.com",
            Password = "P@ssword123",
            Role = "TourGuide"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AdminCreateUser_WithTravelerToken_ReturnsForbidden()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync("/api/auth/register", new { Name = "T", Email = email, Password = "P@ssword123" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        var response = await client.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Should Fail",
            Email = "should-fail-2@example.com",
            Password = "P@ssword123",
            Role = "TourGuide"
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AdminCreateUser_WithAdminToken_CreatesUserWithRequestedRole()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        loginResponse.EnsureSuccessStatusCode();
        var adminAuth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminAuth!.Token);
        var email = $"guide-{Guid.NewGuid():N}@example.com";
        var response = await client.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "New Guide",
            Email = email,
            Password = "P@ssword123",
            Role = "TourGuide"
        });

        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<UserDto>(JsonOptions);
        Assert.Equal(email, created!.Email);
        Assert.Equal("TourGuide", created.Role.ToString());
    }
}
