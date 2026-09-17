using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TrailWise.Api.Contracts.Auth;
using Xunit;

namespace TrailWise.Api.Tests;

public class ProfileEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public ProfileEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task UpdateProfile_ChangesNameAndEmail_ReflectedOnMe()
    {
        var (client, _) = await RegisterAndLoginAsync();
        var newEmail = $"updated-{Guid.NewGuid():N}@example.com";

        var response = await client.PutAsJsonAsync("/api/auth/me", new { Name = "Updated Name", Email = newEmail });
        response.EnsureSuccessStatusCode();

        var meResponse = await client.GetAsync("/api/auth/me");
        var me = await meResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);
        Assert.Equal("Updated Name", me!.Name);
        Assert.Equal(newEmail, me.Email);
    }

    [Fact]
    public async Task ChangePassword_WithWrongCurrentPassword_ReturnsBadRequest()
    {
        var (client, _) = await RegisterAndLoginAsync();

        var response = await client.PutAsJsonAsync("/api/auth/me/password", new
        {
            CurrentPassword = "WrongPassword1",
            NewPassword = "NewP@ssword123"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_WithCorrectCurrentPassword_AllowsLoginWithNewPassword()
    {
        var (client, email) = await RegisterAndLoginAsync();

        var response = await client.PutAsJsonAsync("/api/auth/me/password", new
        {
            CurrentPassword = "P@ssword123",
            NewPassword = "NewP@ssword123"
        });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var loginResponse = await _factory.CreateClient().PostAsJsonAsync("/api/auth/login", new
        {
            Email = email,
            Password = "NewP@ssword123"
        });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
    }

    private async Task<(HttpClient Client, string Email)> RegisterAndLoginAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync("/api/auth/register", new { Name = "T", Email = email, Password = "P@ssword123" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, email);
    }
}
