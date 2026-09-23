using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Reports;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class ReportsEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public ReportsEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetAuditLogs_AsOperationsManager_ReturnsOkWithAuditReportResponse()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var entityId = Guid.NewGuid();
        var travelerId = Guid.NewGuid();
        await SeedAuditLogAsync("Payment", entityId, "PaymentRecorded", travelerId, DateTimeOffset.UtcNow, "{\"amount\":100}");

        var response = await client.GetAsync("/api/reports/audit");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var report = await response.Content.ReadFromJsonAsync<AuditReportResponse>(JsonOptions);
        Assert.NotNull(report);
        Assert.True(report.TotalCount >= 1);
        Assert.Equal(1, report.Page);
        Assert.Equal(20, report.PageSize);
        Assert.True(report.TotalPages >= 1);
        Assert.Contains(report.Items, a => a.EntityId == entityId && a.Action == "PaymentRecorded");
    }

    [Fact]
    public async Task GetAuditLogs_AsAdmin_ReturnsOkWithAuditReportResponse()
    {
        var client = await AuthenticatedAdminAsync(_factory.CreateClient());

        var response = await client.GetAsync("/api/reports/audit");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetAuditLogs_AsTraveler_ReturnsForbidden()
    {
        var client = await AuthenticatedTravelerAsync(_factory.CreateClient());

        var response = await client.GetAsync("/api/reports/audit");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetAuditLogs_Unauthenticated_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/reports/audit");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetAuditLogs_WithEntityTypeFilter_ReturnsMatchingRowsOnly()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var paymentEntityId = Guid.NewGuid();
        var reviewEntityId = Guid.NewGuid();
        await SeedAuditLogAsync("UniquePaymentType", paymentEntityId, "PaymentRecorded", Guid.NewGuid(), DateTimeOffset.UtcNow, "{\"amount\":250}");
        await SeedAuditLogAsync("UniqueReviewType", reviewEntityId, "ReviewSubmitted", Guid.NewGuid(), DateTimeOffset.UtcNow, "{\"rating\":5}");

        // Filter exact
        var response = await client.GetAsync("/api/reports/audit?entityType=UniquePaymentType");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var report = await response.Content.ReadFromJsonAsync<AuditReportResponse>(JsonOptions);
        Assert.NotNull(report);
        Assert.All(report.Items, item => Assert.Equal("UniquePaymentType", item.EntityType, ignoreCase: true));
        Assert.Contains(report.Items, item => item.EntityId == paymentEntityId);
        Assert.DoesNotContain(report.Items, item => item.EntityId == reviewEntityId);

        // Filter case-insensitive
        var caseInsensitiveResponse = await client.GetAsync("/api/reports/audit?entityType=uniquepaymenttype");
        Assert.Equal(HttpStatusCode.OK, caseInsensitiveResponse.StatusCode);
        var caseInsensitiveReport = await caseInsensitiveResponse.Content.ReadFromJsonAsync<AuditReportResponse>(JsonOptions);
        Assert.NotNull(caseInsensitiveReport);
        Assert.Contains(caseInsensitiveReport.Items, item => item.EntityId == paymentEntityId);
    }

    [Fact]
    public async Task GetAuditLogs_WithDateRangeFilter_ReturnsOnlyWithinRange()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var baseTime = DateTimeOffset.UtcNow;
        var oldId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        var futureId = Guid.NewGuid();

        await SeedAuditLogAsync("DateRangeTest", oldId, "OldAction", Guid.NewGuid(), baseTime.AddHours(-10));
        await SeedAuditLogAsync("DateRangeTest", targetId, "TargetAction", Guid.NewGuid(), baseTime.AddHours(-5));
        await SeedAuditLogAsync("DateRangeTest", futureId, "FutureAction", Guid.NewGuid(), baseTime.AddHours(-1));

        var from = Uri.EscapeDataString(baseTime.AddHours(-6).ToString("O"));
        var to = Uri.EscapeDataString(baseTime.AddHours(-4).ToString("O"));

        var response = await client.GetAsync($"/api/reports/audit?entityType=DateRangeTest&from={from}&to={to}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var report = await response.Content.ReadFromJsonAsync<AuditReportResponse>(JsonOptions);
        Assert.NotNull(report);
        Assert.Single(report.Items);
        Assert.Equal(targetId, report.Items[0].EntityId);
    }

    [Fact]
    public async Task GetAuditLogs_WithInvalidDateRange_ReturnsBadRequest()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var from = Uri.EscapeDataString(DateTimeOffset.UtcNow.ToString("O"));
        var to = Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(-1).ToString("O"));

        var response = await client.GetAsync($"/api/reports/audit?from={from}&to={to}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetAuditLogs_Pagination_ReturnsCorrectPageAndPageSize()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var tag = $"Paged-{Guid.NewGuid():N}";
        for (var i = 0; i < 5; i++)
        {
            await SeedAuditLogAsync(tag, Guid.NewGuid(), $"Action-{i}", Guid.NewGuid(), DateTimeOffset.UtcNow.AddMinutes(-i));
        }

        var response = await client.GetAsync($"/api/reports/audit?entityType={tag}&page=2&pageSize=2");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var report = await response.Content.ReadFromJsonAsync<AuditReportResponse>(JsonOptions);
        Assert.NotNull(report);
        Assert.Equal(2, report.Page);
        Assert.Equal(2, report.PageSize);
        Assert.Equal(5, report.TotalCount);
        Assert.Equal(3, report.TotalPages);
        Assert.Equal(2, report.Items.Count);
    }

    [Fact]
    public async Task GetAuditLogs_WithInvalidPagination_ReturnsBadRequest()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var pageZeroResponse = await client.GetAsync("/api/reports/audit?page=0");
        Assert.Equal(HttpStatusCode.BadRequest, pageZeroResponse.StatusCode);

        var oversizedResponse = await client.GetAsync("/api/reports/audit?pageSize=150");
        Assert.Equal(HttpStatusCode.BadRequest, oversizedResponse.StatusCode);
    }

    [Fact]
    public async Task GetAuditLogs_Ordering_ReturnsNewestFirst()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var tag = $"Order-{Guid.NewGuid():N}";
        var id1 = Guid.NewGuid();
        var id2 = Guid.NewGuid();
        var id3 = Guid.NewGuid();

        await SeedAuditLogAsync(tag, id1, "First", Guid.NewGuid(), DateTimeOffset.UtcNow.AddHours(-3));
        await SeedAuditLogAsync(tag, id2, "Second", Guid.NewGuid(), DateTimeOffset.UtcNow.AddHours(-1));
        await SeedAuditLogAsync(tag, id3, "Third", Guid.NewGuid(), DateTimeOffset.UtcNow.AddHours(-2));

        var response = await client.GetAsync($"/api/reports/audit?entityType={tag}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var report = await response.Content.ReadFromJsonAsync<AuditReportResponse>(JsonOptions);
        Assert.NotNull(report);
        Assert.Equal(3, report.Items.Count);
        Assert.Equal(id2, report.Items[0].EntityId); // newest (-1h)
        Assert.Equal(id3, report.Items[1].EntityId); // middle (-2h)
        Assert.Equal(id1, report.Items[2].EntityId); // oldest (-3h)
    }

    [Fact]
    public async Task ExportAuditLogsCsv_ReturnsCsvFileWithHeadersAndRows()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var tag = $"ExportTest-{Guid.NewGuid():N}";
        var entityId = Guid.NewGuid();
        var travelerId = Guid.NewGuid();
        await SeedAuditLogAsync(tag, entityId, "ExportAction", travelerId, DateTimeOffset.UtcNow, "{\"amount\":500}");

        var response = await client.GetAsync($"/api/reports/audit/export?entityType={tag}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(response.Content.Headers.ContentType);
        Assert.Equal("text/csv", response.Content.Headers.ContentType.MediaType);

        var contentDisposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(contentDisposition);
        Assert.Equal("attachment", contentDisposition.DispositionType);
        Assert.Contains("trailwise-audit-report-", contentDisposition.FileName);
        Assert.EndsWith(".csv", contentDisposition.FileName);

        var csvContent = await response.Content.ReadAsStringAsync();
        Assert.Contains("Timestamp,EntityType,EntityId,Action,PerformedBy,Details", csvContent);
        Assert.Contains(tag, csvContent);
        Assert.Contains(entityId.ToString(), csvContent);
        Assert.Contains("ExportAction", csvContent);
        Assert.Contains(travelerId.ToString(), csvContent);
    }

    [Fact]
    public async Task ExportAuditLogsCsv_EscapesDetailsWithCommasAndQuotes()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var tag = $"EscapeTest-{Guid.NewGuid():N}";
        var entityId = Guid.NewGuid();
        var specialDetails = "{\"note\":\"hello, world with \\\"quotes\\\" and commas\"}";
        await SeedAuditLogAsync(tag, entityId, "EscapeAction", Guid.NewGuid(), DateTimeOffset.UtcNow, specialDetails);

        var response = await client.GetAsync($"/api/reports/audit/export?entityType={tag}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var csvContent = await response.Content.ReadAsStringAsync();
        Assert.Contains(tag, csvContent);
        // Quoted and escaped quotes
        Assert.Contains("\"{\"\"note\"\":\"\"hello, world with \\\"\"quotes\\\"\" and commas\"\"}\"", csvContent);
    }

    private async Task SeedAuditLogAsync(
        string entityType,
        Guid entityId,
        string action,
        Guid performedBy,
        DateTimeOffset timestamp,
        string? details = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var log = new AuditLog
        {
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            PerformedBy = performedBy,
            Timestamp = timestamp,
            Details = details
        };

        db.AuditLogs.Add(log);
        await db.SaveChangesAsync();
    }

    private static async Task<HttpClient> AuthenticatedOperationsManagerAsync(HttpClient client)
    {
        var opsManagerEmail = await CreateOperationsManagerAsync(client);
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = opsManagerEmail, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private static async Task<HttpClient> AuthenticatedAdminAsync(HttpClient client)
    {
        var adminLoginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var adminAuth = await adminLoginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminAuth!.Token);
        return client;
    }

    private static async Task<HttpClient> AuthenticatedTravelerAsync(HttpClient client)
    {
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Traveler", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

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
