using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.Testing;
using TrailWise.Api.Contracts.Auth;

namespace TrailWise.Api.Tests;

/// <summary>Small shared helpers for integration tests that need clients with a given role.</summary>
internal static class ApiTestHelpers
{
    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    public static async Task<HttpClient> ClientForRoleAsync(WebApplicationFactory<Program> factory, string role)
    {
        var client = factory.CreateClient();
        string email;
        string password;

        if (role == "Admin")
        {
            email = "admin@test.local";
            password = "TestAdminPass123!";
        }
        else
        {
            email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@example.com";
            password = "P@ssword123";
            if (role == "Traveler")
            {
                await client.PostAsJsonAsync(
                    "/api/auth/register",
                    new { Name = "Traveler", Email = email, Password = password, ContactNumber = "+14155550100" });
            }
            else
            {
                var admin = await ClientForRoleAsync(factory, "Admin");
                var create = await admin.PostAsJsonAsync("/api/auth/admin/users", new
                {
                    Name = $"Staff {role}",
                    Email = email,
                    Password = password,
                    ContactNumber = "+14155550101",
                    Role = role
                });
                create.EnsureSuccessStatusCode();
            }
        }

        var login = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = password });
        login.EnsureSuccessStatusCode();
        var auth = await login.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
