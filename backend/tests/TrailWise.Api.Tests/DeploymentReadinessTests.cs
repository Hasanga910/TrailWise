using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using TrailWise.Api;
using Xunit;

namespace TrailWise.Api.Tests;

public class DeploymentReadinessTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private readonly TrailWiseWebApplicationFactory _factory;

    public DeploymentReadinessTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_IsAnonymousAndHealthyWhenTheDatabaseIsReachable()
    {
        var response = await _factory.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Swagger_IsReachableInProduction()
    {
        using var production = _factory.WithWebHostBuilder(b => b.UseEnvironment("Production"));
        var client = production.CreateClient();

        var json = await client.GetAsync("/swagger/v1/swagger.json");
        var ui = await client.GetAsync("/swagger/index.html");

        Assert.Equal(HttpStatusCode.OK, json.StatusCode);
        Assert.Equal(HttpStatusCode.OK, ui.StatusCode);
    }

    [Fact]
    public async Task Cors_AllowsEveryOriginFromTheCommaSeparatedSetting()
    {
        using var configured = _factory.WithWebHostBuilder(b => b.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cors:AllowedOrigins"] = "https://trailwise.vercel.app/, https://staging.example.com",
            })));

        foreach (var origin in new[] { "https://trailwise.vercel.app", "https://staging.example.com" })
        {
            using var request = new HttpRequestMessage(HttpMethod.Options, "/api/packages");
            request.Headers.Add("Origin", origin);
            request.Headers.Add("Access-Control-Request-Method", "GET");
            var response = await configured.CreateClient().SendAsync(request);

            Assert.Equal(origin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        }

        using var other = new HttpRequestMessage(HttpMethod.Options, "/api/packages");
        other.Headers.Add("Origin", "https://evil.example.com");
        other.Headers.Add("Access-Control-Request-Method", "GET");
        var denied = await configured.CreateClient().SendAsync(other);
        Assert.False(denied.Headers.Contains("Access-Control-Allow-Origin"));
    }
}

public class CorsOriginsTests
{
    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value))
            .Build();

    [Fact]
    public void CommaSeparatedValue_IsSplitTrimmedAndStripsTrailingSlashes()
    {
        var origins = CorsOrigins.Read(Config(("Cors:AllowedOrigins", " https://a.vercel.app/ ,https://b.example.com,https://a.vercel.app")));

        Assert.Equal(new[] { "https://a.vercel.app", "https://b.example.com" }, origins);
    }

    [Fact]
    public void IndexedArray_StillWorks()
    {
        var origins = CorsOrigins.Read(Config(("Cors:AllowedOrigins:0", "http://localhost:5173"), ("Cors:AllowedOrigins:1", "http://localhost:5000")));

        Assert.Equal(new[] { "http://localhost:5173", "http://localhost:5000" }, origins);
    }

    [Fact]
    public void NothingConfigured_FallsBackToTheLocalDevOrigin()
    {
        Assert.Equal(new[] { "http://localhost:5173" }, CorsOrigins.Read(Config()));
    }
}
