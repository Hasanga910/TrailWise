using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;
using static TrailWise.Api.Tests.ApiTestHelpers;

namespace TrailWise.Api.Tests;

/// <summary>Host with only the seeded Admin: no packages, vehicles, drivers, guides or bookings.</summary>
public class EmptyTrailWiseWebApplicationFactory : TrailWiseWebApplicationFactory
{
    protected override bool SeedTestCatalogue => false;
}

/// <summary>The real first-run state: every list and dashboard must answer with empty data, not errors.</summary>
public class EmptyDatabaseEndpointsTests : IClassFixture<EmptyTrailWiseWebApplicationFactory>
{
    private readonly EmptyTrailWiseWebApplicationFactory _factory;

    public EmptyDatabaseEndpointsTests(EmptyTrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData("/api/packages")]
    [InlineData("/api/packages/facets")]
    [InlineData("/api/reviews/featured")]
    public async Task PublicEndpoints_ReturnOkWithNoData(string url)
    {
        var response = await _factory.CreateClient().GetAsync(url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/vehicles")]
    [InlineData("/api/vehicles/assignments")]
    [InlineData("/api/drivers")]
    [InlineData("/api/guides")]
    [InlineData("/api/discounts")]
    [InlineData("/api/bookings")]
    [InlineData("/api/bookings/paged")]
    [InlineData("/api/approvals/pending")]
    [InlineData("/api/agent-workflows")]
    [InlineData("/api/reports/dashboard")]
    [InlineData("/api/reports/occupancy?from=2026-01-01&to=2026-12-31")]
    [InlineData("/api/reports/revenue")]
    [InlineData("/api/reports/guide-utilization")]
    [InlineData("/api/payments/pending")]
    [InlineData("/api/auth/admin/users")]
    public async Task AdminEndpoints_ReturnOkWithNoData(string url)
    {
        var admin = await ClientForRoleAsync(_factory, "Admin");

        var response = await admin.GetAsync(url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Packages_AreAnEmptyList()
    {
        var packages = await _factory.CreateClient().GetFromJsonAsync<JsonElement>("/api/packages");

        Assert.Equal(JsonValueKind.Array, packages.ValueKind);
        Assert.Equal(0, packages.GetArrayLength());
    }

    [Fact]
    public async Task OnlyTheAdminExists()
    {
        var admin = await ClientForRoleAsync(_factory, "Admin");

        var users = await admin.GetFromJsonAsync<JsonElement>("/api/auth/admin/users");

        Assert.Equal(1, users.GetArrayLength());
    }
}
