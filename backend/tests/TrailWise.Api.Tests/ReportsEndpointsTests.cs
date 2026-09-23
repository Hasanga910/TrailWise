using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Reports;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
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

    [Fact]
    public async Task GetOccupancyReport_CalculatesOccupancyAndExcludesNonConfirmedBookings()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var (packageAId, tierAId) = await SeedPackageWithTierAsync($"Occ A {Guid.NewGuid():N}", maxGroupSize: 10);
        var (packageBId, tierBId) = await SeedPackageWithTierAsync($"Occ B {Guid.NewGuid():N}", maxGroupSize: 20);

        var travelerId = Guid.NewGuid();

        // Package A:
        // Booking 1: Confirmed, 4 travelers, 2026-06-05 to 2026-06-10 (overlaps)
        await SeedBookingAsync(packageAId, tierAId, travelerId, 4, BookingStatus.Confirmed, new DateOnly(2026, 6, 5), new DateOnly(2026, 6, 10));
        // Booking 2: Completed, 6 travelers, 2026-06-15 to 2026-06-20 (overlaps)
        await SeedBookingAsync(packageAId, tierAId, travelerId, 6, BookingStatus.Completed, new DateOnly(2026, 6, 15), new DateOnly(2026, 6, 20));
        // Booking 3: Cancelled, 8 travelers, 2026-06-12 to 2026-06-16 (overlaps but cancelled -> excluded)
        await SeedBookingAsync(packageAId, tierAId, travelerId, 8, BookingStatus.Cancelled, new DateOnly(2026, 6, 12), new DateOnly(2026, 6, 16));
        // Booking 4: PendingApproval, 5 travelers, 2026-06-18 to 2026-06-22 (overlaps but pending -> excluded)
        await SeedBookingAsync(packageAId, tierAId, travelerId, 5, BookingStatus.PendingApproval, new DateOnly(2026, 6, 18), new DateOnly(2026, 6, 22));
        // Booking 5: Confirmed, 3 travelers, 2026-07-05 to 2026-07-10 (non-overlapping -> excluded)
        await SeedBookingAsync(packageAId, tierAId, travelerId, 3, BookingStatus.Confirmed, new DateOnly(2026, 7, 5), new DateOnly(2026, 7, 10));

        // Package B:
        // Booking 6: Confirmed, 10 travelers, 2026-06-01 to 2026-06-05
        await SeedBookingAsync(packageBId, tierBId, travelerId, 10, BookingStatus.Confirmed, new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 5));

        var response = await client.GetAsync("/api/reports/occupancy?from=2026-06-01&to=2026-06-30");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var report = await response.Content.ReadFromJsonAsync<List<PackageOccupancyDto>>(JsonOptions);
        Assert.NotNull(report);

        var occA = report.FirstOrDefault(p => p.TourPackageId == packageAId);
        Assert.NotNull(occA);
        Assert.Equal(2, occA.BookingCount);
        Assert.Equal(10, occA.BookedTravelers);
        Assert.Equal(5.0, occA.AverageGroupSize);
        Assert.Equal(50.0, occA.OccupancyPercentage);

        var occB = report.FirstOrDefault(p => p.TourPackageId == packageBId);
        Assert.NotNull(occB);
        Assert.Equal(1, occB.BookingCount);
        Assert.Equal(10, occB.BookedTravelers);
        Assert.Equal(10.0, occB.AverageGroupSize);
        Assert.Equal(50.0, occB.OccupancyPercentage);
    }

    [Fact]
    public async Task GetRevenueReport_CalculatesRevenueCorrectlyWithFiltersAndGroupings()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var (packageAId, tierAId) = await SeedPackageWithTierAsync($"Rev A {Guid.NewGuid():N}", maxGroupSize: 10);
        var (packageBId, tierBId) = await SeedPackageWithTierAsync($"Rev B {Guid.NewGuid():N}", maxGroupSize: 20);

        var travelerId = Guid.NewGuid();
        var bookingAId = await SeedBookingAsync(packageAId, tierAId, travelerId, 2, BookingStatus.Confirmed, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 5));
        var bookingBId = await SeedBookingAsync(packageBId, tierBId, travelerId, 4, BookingStatus.Confirmed, new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 5));

        // Booking A payments: DepositPaid (200), FullyPaid (400), Refunded (300)
        await SeedPaymentAsync(bookingAId, 200m, PaymentStatus.DepositPaid, new DateTimeOffset(2026, 5, 10, 10, 0, 0, TimeSpan.Zero));
        await SeedPaymentAsync(bookingAId, 400m, PaymentStatus.FullyPaid, new DateTimeOffset(2026, 5, 20, 10, 0, 0, TimeSpan.Zero));
        await SeedPaymentAsync(bookingAId, 300m, PaymentStatus.Refunded, new DateTimeOffset(2026, 5, 25, 10, 0, 0, TimeSpan.Zero)); // Excluded

        // Booking B payments: FullyPaid (500), Pending (150)
        await SeedPaymentAsync(bookingBId, 500m, PaymentStatus.FullyPaid, new DateTimeOffset(2026, 6, 15, 10, 0, 0, TimeSpan.Zero));
        await SeedPaymentAsync(bookingBId, 150m, PaymentStatus.Pending, null); // Excluded

        var response = await client.GetAsync("/api/reports/revenue?from=2026-05-01&to=2026-06-30");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var report = await response.Content.ReadFromJsonAsync<RevenueReportResponse>(JsonOptions);
        Assert.NotNull(report);

        // 200 (DepositPaid) + 400 (FullyPaid) + 500 (FullyPaid) = 1100
        Assert.Equal(1100m, report.TotalRevenue);

        // Group by package
        var revA = report.ByPackage.FirstOrDefault(p => p.TourPackageId == packageAId);
        Assert.NotNull(revA);
        Assert.Equal(600m, revA.Revenue);

        var revB = report.ByPackage.FirstOrDefault(p => p.TourPackageId == packageBId);
        Assert.NotNull(revB);
        Assert.Equal(500m, revB.Revenue);

        // Group by month
        var may = report.ByMonth.FirstOrDefault(m => m.Year == 2026 && m.Month == 5);
        Assert.NotNull(may);
        Assert.Equal(600m, may.Revenue);
        Assert.Equal("May 2026", may.Label);

        var jun = report.ByMonth.FirstOrDefault(m => m.Year == 2026 && m.Month == 6);
        Assert.NotNull(jun);
        Assert.Equal(500m, jun.Revenue);
        Assert.Equal("Jun 2026", jun.Label);
    }

    [Fact]
    public async Task GetGuideUtilizationReport_CalculatesUtilizationAccurately()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var (packageId, tierId) = await SeedPackageWithTierAsync($"Guide Tour {Guid.NewGuid():N}", maxGroupSize: 10);
        var bookingId = await SeedBookingAsync(packageId, tierId, Guid.NewGuid(), 2, BookingStatus.Confirmed, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 5));

        var guideAId = await SeedGuideAsync($"Guide A {Guid.NewGuid():N}");
        var guideBId = await SeedGuideAsync($"Guide B {Guid.NewGuid():N}");

        // Guide A: 2 assigned days, 3 available days
        await SeedGuideAvailabilityAsync(guideAId, new DateOnly(2026, 8, 1), isAvailable: true, assignedBookingId: bookingId);
        await SeedGuideAvailabilityAsync(guideAId, new DateOnly(2026, 8, 2), isAvailable: true, assignedBookingId: bookingId);
        await SeedGuideAvailabilityAsync(guideAId, new DateOnly(2026, 8, 3), isAvailable: true, assignedBookingId: null);
        await SeedGuideAvailabilityAsync(guideAId, new DateOnly(2026, 8, 4), isAvailable: true, assignedBookingId: null);
        await SeedGuideAvailabilityAsync(guideAId, new DateOnly(2026, 8, 5), isAvailable: true, assignedBookingId: null);

        // Guide B: 0 recorded days in that range

        var response = await client.GetAsync("/api/reports/guide-utilization?from=2026-08-01&to=2026-08-10");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var report = await response.Content.ReadFromJsonAsync<List<GuideUtilizationDto>>(JsonOptions);
        Assert.NotNull(report);

        var utilA = report.FirstOrDefault(g => g.GuideId == guideAId);
        Assert.NotNull(utilA);
        Assert.Equal(2, utilA.AssignedDays);
        Assert.Equal(3, utilA.AvailableDays);
        Assert.Equal(5, utilA.RecordedDays);
        Assert.Equal(40.0, utilA.UtilizationPercentage);

        var utilB = report.FirstOrDefault(g => g.GuideId == guideBId);
        Assert.NotNull(utilB);
        Assert.Equal(0, utilB.AssignedDays);
        Assert.Equal(0, utilB.AvailableDays);
        Assert.Equal(0, utilB.RecordedDays);
        Assert.Equal(0.0, utilB.UtilizationPercentage);
    }

    [Fact]
    public async Task OperationsReports_WhenAccessedByTraveler_ReturnsForbidden()
    {
        var client = await AuthenticatedTravelerAsync(_factory.CreateClient());

        var occResponse = await client.GetAsync("/api/reports/occupancy?from=2026-01-01&to=2026-01-31");
        Assert.Equal(HttpStatusCode.Forbidden, occResponse.StatusCode);

        var revResponse = await client.GetAsync("/api/reports/revenue?from=2026-01-01&to=2026-01-31");
        Assert.Equal(HttpStatusCode.Forbidden, revResponse.StatusCode);

        var guideResponse = await client.GetAsync("/api/reports/guide-utilization?from=2026-01-01&to=2026-01-31");
        Assert.Equal(HttpStatusCode.Forbidden, guideResponse.StatusCode);
    }

    [Fact]
    public async Task OperationsReports_WhenUnauthenticated_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var occResponse = await client.GetAsync("/api/reports/occupancy?from=2026-01-01&to=2026-01-31");
        Assert.Equal(HttpStatusCode.Unauthorized, occResponse.StatusCode);

        var revResponse = await client.GetAsync("/api/reports/revenue?from=2026-01-01&to=2026-01-31");
        Assert.Equal(HttpStatusCode.Unauthorized, revResponse.StatusCode);

        var guideResponse = await client.GetAsync("/api/reports/guide-utilization?from=2026-01-01&to=2026-01-31");
        Assert.Equal(HttpStatusCode.Unauthorized, guideResponse.StatusCode);
    }

    [Fact]
    public async Task OperationsReports_Validation_ReturnsBadRequestOnInvalidDates()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        // Occupancy: missing from
        var missingFrom = await client.GetAsync("/api/reports/occupancy?to=2026-01-31");
        Assert.Equal(HttpStatusCode.BadRequest, missingFrom.StatusCode);

        // Occupancy: missing to
        var missingTo = await client.GetAsync("/api/reports/occupancy?from=2026-01-01");
        Assert.Equal(HttpStatusCode.BadRequest, missingTo.StatusCode);

        // Occupancy: from > to
        var invalidOccDates = await client.GetAsync("/api/reports/occupancy?from=2026-02-01&to=2026-01-01");
        Assert.Equal(HttpStatusCode.BadRequest, invalidOccDates.StatusCode);

        // Revenue: from > to
        var invalidRevDates = await client.GetAsync("/api/reports/revenue?from=2026-02-01&to=2026-01-01");
        Assert.Equal(HttpStatusCode.BadRequest, invalidRevDates.StatusCode);

        // Guide Utilization: from > to
        var invalidGuideDates = await client.GetAsync("/api/reports/guide-utilization?from=2026-02-01&to=2026-01-01");
        Assert.Equal(HttpStatusCode.BadRequest, invalidGuideDates.StatusCode);
    }

    private async Task<(Guid PackageId, Guid TierId)> SeedPackageWithTierAsync(string name, int maxGroupSize)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var package = new TourPackage
        {
            Name = name,
            Theme = "Adventure",
            DurationDays = 3,
            BasePricePerPerson = 200m,
            MaxGroupSize = maxGroupSize
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = false,
            BasePricePerPerson = 200m,
            RequiresAC = false
        };
        db.TourPackages.Add(package);
        db.PackageTiers.Add(tier);
        await db.SaveChangesAsync();

        return (package.Id, tier.Id);
    }

    private async Task<Guid> SeedBookingAsync(
        Guid packageId,
        Guid tierId,
        Guid travelerId,
        int groupSize,
        BookingStatus status,
        DateOnly startDate,
        DateOnly endDate)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var booking = new Booking
        {
            TourPackageId = packageId,
            PackageTierId = tierId,
            TravelerId = travelerId,
            GroupSize = groupSize,
            Status = status,
            StartDate = startDate,
            EndDate = endDate,
            BudgetPerPerson = 500m
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        return booking.Id;
    }

    private async Task<Guid> SeedPaymentAsync(
        Guid bookingId,
        decimal amount,
        PaymentStatus status,
        DateTimeOffset? paidAt)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var payment = new Payment
        {
            BookingId = bookingId,
            Amount = amount,
            Method = "Card",
            Status = status,
            PaidAt = paidAt
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();

        return payment.Id;
    }

    private async Task<Guid> SeedGuideAsync(string name)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var guide = new Guide
        {
            Name = name,
            ContactInfo = "guide@example.com"
        };
        db.Guides.Add(guide);
        await db.SaveChangesAsync();

        return guide.Id;
    }

    private async Task SeedGuideAvailabilityAsync(
        Guid guideId,
        DateOnly date,
        bool isAvailable,
        Guid? assignedBookingId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var availability = new GuideAvailability
        {
            GuideId = guideId,
            Date = date,
            IsAvailable = isAvailable,
            AssignedBookingId = assignedBookingId
        };
        db.GuideAvailabilities.Add(availability);
        await db.SaveChangesAsync();
    }
}

