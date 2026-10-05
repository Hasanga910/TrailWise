using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Approvals;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

/// <summary>
/// Cancellation / refund exception (design doc 8.3): a traveler cancelling fewer than 7 days before
/// the start with an approved payment needs the Operations Manager's approval.
/// </summary>
public class RefundExceptionEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public RefundExceptionEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed record Seeded(HttpClient Traveler, Guid BookingId, Guid GuideId, List<Guid> PaymentIds, string TravelerName);

    // ---------------------------------------------------------------- the window rule

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(6)]
    public async Task Cancel_InsideTheWindowWithAnApprovedPayment_CreatesARefundExceptionInsteadOfCancelling(int daysUntilStart)
    {
        var seeded = await SeedAsync(daysUntilStart, (100m, PaymentStatus.DepositPaid));

        var response = await seeded.Traveler.PatchAsJsonAsync(
            $"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "  Family emergency  " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.True(body!.ApprovalPending);
        Assert.Equal(BookingStatus.PendingApproval, body.Status);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var booking = await db.Bookings.SingleAsync(b => b.Id == seeded.BookingId);
        Assert.Equal(BookingStatus.PendingApproval, booking.Status);
        Assert.Null(booking.CancellationReason);

        var approval = await db.ApprovalRequests.SingleAsync(a => a.BookingId == seeded.BookingId);
        Assert.Equal(ApprovalType.RefundException, approval.Type);
        Assert.Equal(ApprovalStatus.Pending, approval.Status);
        Assert.Equal(BookingStatus.Confirmed, approval.PreviousBookingStatus);
        Assert.Equal("Family emergency", approval.RequesterNote);
        Assert.Contains($"{daysUntilStart} day(s) before the start date", approval.ReasonsJson);

        // Nothing is released or refunded until the Operations Manager decides.
        Assert.True(await db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == seeded.BookingId));
        Assert.True(await db.VehicleAssignments.AnyAsync(a => a.BookingId == seeded.BookingId));
        Assert.Equal(PaymentStatus.DepositPaid, (await db.Payments.SingleAsync(p => p.BookingId == seeded.BookingId)).Status);

        var audit = await db.AuditLogs.SingleAsync(a => a.EntityId == seeded.BookingId && a.Action == "RefundExceptionRequested");
        Assert.NotNull(audit.PerformedBy);
        Assert.Contains(approval.Id.ToString(), audit.Details);
    }

    [Fact]
    public async Task Cancel_ExactlySevenDaysBeforeStart_IsAStandardCancellation()
    {
        var seeded = await SeedAsync(7, (100m, PaymentStatus.FullyPaid));

        var response = await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "Plans changed" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.False(body!.ApprovalPending);
        Assert.Equal(BookingStatus.Cancelled, body.Status);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        Assert.False(await db.ApprovalRequests.AnyAsync(a => a.BookingId == seeded.BookingId));
        // Standard cancellation: no automatic refund.
        Assert.Equal(PaymentStatus.FullyPaid, (await db.Payments.SingleAsync(p => p.BookingId == seeded.BookingId)).Status);
        Assert.False(await db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == seeded.BookingId));
    }

    [Theory]
    [InlineData(PaymentStatus.Pending)]
    [InlineData(PaymentStatus.Failed)]
    [InlineData(PaymentStatus.Refunded)]
    public async Task Cancel_InsideTheWindowWithoutAnApprovedPayment_CancelsImmediately(PaymentStatus status)
    {
        var seeded = await SeedAsync(3, (100m, status));

        var response = await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "x" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(BookingStatus.Cancelled, (await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions))!.Status);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        Assert.False(await db.ApprovalRequests.AnyAsync(a => a.BookingId == seeded.BookingId));
    }

    [Fact]
    public async Task Cancel_InsideTheWindowWithNoPaymentAtAll_CancelsImmediately()
    {
        var seeded = await SeedAsync(2);

        var response = await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "x" });

        Assert.Equal(BookingStatus.Cancelled, (await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions))!.Status);
    }

    [Fact]
    public async Task Cancel_ByStaffInsideTheWindow_StillCancelsDirectly_WithoutRefundingAnything()
    {
        var seeded = await SeedAsync(2, (100m, PaymentStatus.FullyPaid));
        var ops = await StaffClientAsync("OperationsManager");

        var response = await ops.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "Operational" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.False(body!.ApprovalPending);
        Assert.Equal(BookingStatus.Cancelled, body.Status);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        Assert.False(await db.ApprovalRequests.AnyAsync(a => a.BookingId == seeded.BookingId));
        Assert.Equal(PaymentStatus.FullyPaid, (await db.Payments.SingleAsync(p => p.BookingId == seeded.BookingId)).Status);
    }

    [Fact]
    public async Task Cancel_WhileARefundExceptionIsPending_Returns409_AndKeepsASingleRequest()
    {
        var seeded = await SeedAsync(3, (100m, PaymentStatus.DepositPaid));
        var first = await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "one" });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "two" });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        Assert.Single(db.ApprovalRequests, a => a.BookingId == seeded.BookingId);
    }

    [Fact]
    public async Task Cancel_ForAnotherTravelersBooking_IsStillForbidden()
    {
        var seeded = await SeedAsync(3, (100m, PaymentStatus.DepositPaid));
        var stranger = await TravelerClientAsync();

        var response = await stranger.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "x" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        Assert.False(await db.ApprovalRequests.AnyAsync(a => a.BookingId == seeded.BookingId));
    }

    [Fact]
    public async Task TheWindowIsConfigurable()
    {
        using var factory = new TrailWiseWebApplicationFactory().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?> { ["Cancellation:RefundWindowDays"] = "14" })));
        var seeded = await SeedAsync(10, factory, (100m, PaymentStatus.FullyPaid));

        var response = await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "x" });

        // 10 days is outside the default 7-day window but inside the configured 14-day window.
        Assert.True((await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions))!.ApprovalPending);
    }

    [Fact]
    public async Task Cancel_Normally_ClosesAnyOpenApprovalForThatBooking()
    {
        var seeded = await SeedAsync(30);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var booking = await db.Bookings.SingleAsync(b => b.Id == seeded.BookingId);
            booking.Status = BookingStatus.PendingApproval;
            db.ApprovalRequests.Add(new ApprovalRequest
            {
                BookingId = booking.Id,
                Type = ApprovalType.LargeGroupOrCustomItinerary,
                Status = ApprovalStatus.Pending
            });
            await db.SaveChangesAsync();
        }

        var response = await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "x" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var verify = _factory.Services.CreateScope();
        var verifyDb = verify.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        Assert.Equal(ApprovalStatus.Superseded, (await verifyDb.ApprovalRequests.SingleAsync(a => a.BookingId == seeded.BookingId)).Status);
        var pending = await GetPendingAsync(await StaffClientAsync("OperationsManager"));
        Assert.DoesNotContain(pending.Items, i => i.BookingId == seeded.BookingId);
    }

    // ---------------------------------------------------------------- queue evidence

    [Fact]
    public async Task Pending_ShowsTheRefundExceptionWithItsPaymentAndCancellationEvidence()
    {
        var seeded = await SeedAsync(
            3, (100m, PaymentStatus.DepositPaid), (200m, PaymentStatus.FullyPaid), (50m, PaymentStatus.Pending));
        await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "Visa refused" });

        var pending = await GetPendingAsync(await StaffClientAsync("OperationsManager"));

        var item = Assert.Single(pending.Items, i => i.BookingId == seeded.BookingId);
        Assert.Equal(ApprovalType.RefundException, item.Type);
        Assert.True(pending.Counts.RefundException >= 1);
        Assert.NotNull(item.Refund);
        Assert.Equal(3, item.Refund!.DaysUntilStart);
        Assert.Equal(7, item.Refund.WindowDays);
        Assert.Equal("Visa refused", item.Refund.TravelerReason);
        Assert.Equal(BookingStatus.Confirmed, item.Refund.PreviousBookingStatus);
        Assert.Equal(300m, item.Refund.ApprovedPaymentTotal);
        Assert.Equal(3, item.Refund.Payments.Count);
        Assert.Contains(item.Refund.Payments, p => p.Amount == 50m && p.Status == PaymentStatus.Pending);
        Assert.Equal(2, item.Reasons.Count);
        Assert.Equal(seeded.TravelerName, item.Booking.TravelerName);
    }

    // ---------------------------------------------------------------- decisions

    [Fact]
    public async Task Approve_RefundsApprovedPayments_CancelsTheBooking_AndReleasesGuideAndVehicle()
    {
        var seeded = await SeedAsync(
            3, (100m, PaymentStatus.DepositPaid), (200m, PaymentStatus.FullyPaid), (50m, PaymentStatus.Pending));
        await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "Visa refused" });
        var approvalId = await ApprovalIdAsync(seeded.BookingId);

        var response = await (await StaffClientAsync("OperationsManager"))
            .PostAsJsonAsync($"/api/approvals/{approvalId}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApprovalDecidedDto>(JsonOptions);
        Assert.Equal(ApprovalStatus.Approved, body!.Status);
        Assert.Equal(BookingStatus.Cancelled, body.Booking.Status);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var booking = await db.Bookings.SingleAsync(b => b.Id == seeded.BookingId);
        Assert.Equal(BookingStatus.Cancelled, booking.Status);
        Assert.Equal("Visa refused", booking.CancellationReason);

        var payments = await db.Payments.Where(p => p.BookingId == seeded.BookingId).ToListAsync();
        Assert.Equal(2, payments.Count(p => p.Status == PaymentStatus.Refunded));
        Assert.Equal(PaymentStatus.Pending, payments.Single(p => p.Amount == 50m).Status); // unapproved payments are untouched

        Assert.False(await db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == seeded.BookingId));
        Assert.False(await db.VehicleAssignments.AnyAsync(a => a.BookingId == seeded.BookingId));

        var approval = await db.ApprovalRequests.SingleAsync(a => a.Id == approvalId);
        Assert.Equal(ApprovalStatus.Approved, approval.Status);
        Assert.NotNull(approval.DecidedBy);

        var audit = await db.AuditLogs.SingleAsync(a => a.EntityId == seeded.BookingId && a.Action == "RefundExceptionApproved");
        Assert.NotNull(audit.PerformedBy);
        Assert.Contains("300", audit.Details);
    }

    [Fact]
    public async Task Reject_CancelsWithoutRefund_AndReleasesGuideAndVehicle()
    {
        var seeded = await SeedAsync(3, (100m, PaymentStatus.FullyPaid));
        await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "Changed my mind" });
        var approvalId = await ApprovalIdAsync(seeded.BookingId);

        var response = await (await StaffClientAsync("OperationsManager"))
            .PostAsJsonAsync($"/api/approvals/{approvalId}/decide", new { Decision = "Reject", Note = "Outside policy, no refund." });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var booking = await db.Bookings.SingleAsync(b => b.Id == seeded.BookingId);
        Assert.Equal(BookingStatus.Cancelled, booking.Status);
        Assert.Equal("Changed my mind", booking.CancellationReason);
        Assert.Equal(PaymentStatus.FullyPaid, (await db.Payments.SingleAsync(p => p.BookingId == seeded.BookingId)).Status);
        Assert.False(await db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == seeded.BookingId));
        Assert.False(await db.VehicleAssignments.AnyAsync(a => a.BookingId == seeded.BookingId));
        var approval = await db.ApprovalRequests.SingleAsync(a => a.Id == approvalId);
        Assert.Equal(ApprovalStatus.Rejected, approval.Status);
        Assert.Equal("Outside policy, no refund.", approval.DecisionNote);
        Assert.True(await db.AuditLogs.AnyAsync(a => a.EntityId == seeded.BookingId && a.Action == "RefundExceptionRejected"));
    }

    [Fact]
    public async Task RequestRevision_ReturnsTheBookingToItsPreviousStatus_WithTheNote_AndKeepsEverythingHeld()
    {
        var seeded = await SeedAsync(3, (100m, PaymentStatus.FullyPaid));
        await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "x" });
        var approvalId = await ApprovalIdAsync(seeded.BookingId);

        var response = await (await StaffClientAsync("OperationsManager")).PostAsJsonAsync(
            $"/api/approvals/{approvalId}/decide", new { Decision = "RequestRevision", Note = "Please attach proof of the emergency." });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApprovalDecidedDto>(JsonOptions);
        Assert.Equal(BookingStatus.Confirmed, body!.Booking.Status);
        Assert.Equal("Please attach proof of the emergency.", body.Booking.RevisionNote);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        Assert.Equal(ApprovalStatus.RevisionRequested, (await db.ApprovalRequests.SingleAsync(a => a.Id == approvalId)).Status);
        Assert.Equal(PaymentStatus.FullyPaid, (await db.Payments.SingleAsync(p => p.BookingId == seeded.BookingId)).Status);
        Assert.True(await db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == seeded.BookingId));
        Assert.True(await db.VehicleAssignments.AnyAsync(a => a.BookingId == seeded.BookingId));
        Assert.True(await db.AuditLogs.AnyAsync(a => a.EntityId == seeded.BookingId && a.Action == "RefundExceptionRevisionRequested"));

        // The traveler can ask again afterwards: a fresh request is created.
        var again = await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "Here is the proof" });
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(2, await db.ApprovalRequests.CountAsync(a => a.BookingId == seeded.BookingId));
    }

    [Theory]
    [InlineData("Reject")]
    [InlineData("RequestRevision")]
    public async Task RejectOrRevision_WithoutANote_Returns400_AndChangesNothing(string decision)
    {
        var seeded = await SeedAsync(3, (100m, PaymentStatus.FullyPaid));
        await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "x" });
        var approvalId = await ApprovalIdAsync(seeded.BookingId);

        var response = await (await StaffClientAsync("OperationsManager"))
            .PostAsJsonAsync($"/api/approvals/{approvalId}/decide", new { Decision = decision, Note = "  " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertStillPendingAsync(seeded);
    }

    [Fact]
    public async Task Decide_AfterStaffCancelledTheBooking_Returns409_AndRefundsNothing()
    {
        var seeded = await SeedAsync(3, (100m, PaymentStatus.FullyPaid));
        await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "x" });
        var approvalId = await ApprovalIdAsync(seeded.BookingId);
        var ops = await StaffClientAsync("OperationsManager");
        (await ops.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "Operational" })).EnsureSuccessStatusCode();

        var response = await ops.PostAsJsonAsync($"/api/approvals/{approvalId}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        Assert.Equal(PaymentStatus.FullyPaid, (await db.Payments.SingleAsync(p => p.BookingId == seeded.BookingId)).Status);
    }

    [Fact]
    public async Task Decide_Twice_Returns409_AndRefundsOnlyOnce()
    {
        var seeded = await SeedAsync(3, (100m, PaymentStatus.FullyPaid));
        await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "x" });
        var approvalId = await ApprovalIdAsync(seeded.BookingId);
        var ops = await StaffClientAsync("OperationsManager");
        (await ops.PostAsJsonAsync($"/api/approvals/{approvalId}/decide", new { Decision = "Approve" })).EnsureSuccessStatusCode();

        var second = await ops.PostAsJsonAsync($"/api/approvals/{approvalId}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        Assert.Single(db.AuditLogs, a => a.EntityId == seeded.BookingId && a.Action == "RefundExceptionApproved");
    }

    [Theory]
    [InlineData("Traveler")]
    [InlineData("FleetCoordinator")]
    [InlineData("TourGuide")]
    public async Task Decide_IsForbiddenForOtherRoles(string role)
    {
        var seeded = await SeedAsync(3, (100m, PaymentStatus.FullyPaid));
        await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "x" });
        var approvalId = await ApprovalIdAsync(seeded.BookingId);

        var response = await (await StaffClientAsync(role))
            .PostAsJsonAsync($"/api/approvals/{approvalId}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await AssertStillPendingAsync(seeded);
    }

    [Fact]
    public async Task LegacyBookingDecide_RefusesABookingWithAPendingRefundException()
    {
        var seeded = await SeedAsync(3, (100m, PaymentStatus.FullyPaid));
        await seeded.Traveler.PatchAsJsonAsync($"/api/bookings/{seeded.BookingId}/cancel", new { Reason = "x" });

        var response = await (await StaffClientAsync("OperationsManager"))
            .PostAsJsonAsync($"/api/bookings/{seeded.BookingId}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        await AssertStillPendingAsync(seeded);
    }

    // ---------------------------------------------------------------- helpers

    private async Task AssertStillPendingAsync(Seeded seeded)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        Assert.Equal(BookingStatus.PendingApproval, (await db.Bookings.SingleAsync(b => b.Id == seeded.BookingId)).Status);
        Assert.Equal(ApprovalStatus.Pending, (await db.ApprovalRequests.SingleAsync(a => a.BookingId == seeded.BookingId)).Status);
        Assert.All(db.Payments.Where(p => p.BookingId == seeded.BookingId), p => Assert.NotEqual(PaymentStatus.Refunded, p.Status));
        Assert.True(await db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == seeded.BookingId));
        Assert.True(await db.VehicleAssignments.AnyAsync(a => a.BookingId == seeded.BookingId));
        Assert.False(await db.AuditLogs.AnyAsync(a => a.EntityId == seeded.BookingId && a.Action.StartsWith("RefundExceptionA")));
    }

    private async Task<Guid> ApprovalIdAsync(Guid bookingId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        return await db.ApprovalRequests
            .Where(a => a.BookingId == bookingId && a.Status == ApprovalStatus.Pending)
            .Select(a => a.Id)
            .SingleAsync();
    }

    private static async Task<PendingApprovalsDto> GetPendingAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<PendingApprovalsDto>("/api/approvals/pending", JsonOptions))!;

    private Task<Seeded> SeedAsync(int daysUntilStart, params (decimal Amount, PaymentStatus Status)[] payments) =>
        SeedAsync(daysUntilStart, _factory, payments);

    /// <summary>A Confirmed booking starting in N days with its guide, vehicle and the given payments.</summary>
    private static async Task<Seeded> SeedAsync(
        int daysUntilStart, WebApplicationFactory<Program> factory, params (decimal Amount, PaymentStatus Status)[] payments)
    {
        var (traveler, email, name) = await TravelerWithEmailAsync(factory);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var travelerId = await db.Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync();

        var theme = $"Theme-{Guid.NewGuid():N}";
        var package = new TourPackage { Name = $"Refund Package {theme}", Theme = theme, DurationDays = 3, BasePricePerPerson = 100m, MaxGroupSize = 20 };
        var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, BasePricePerPerson = 100m };
        var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(daysUntilStart));
        var booking = new Booking
        {
            TravelerId = travelerId,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = start,
            EndDate = start.AddDays(3),
            BudgetPerPerson = 200m,
            Status = BookingStatus.Confirmed
        };
        var guide = new Guide { Name = "Refund Guide", Specializations = new[] { theme }, Languages = new[] { "English" }, ContactInfo = "g@example.com" };
        var vehicle = new Vehicle
        {
            Type = VehicleType.Van,
            RegistrationNumber = $"REG-{Guid.NewGuid():N}"[..10],
            Capacity = 8,
            HasAC = true,
            SeatConfiguration = "2-2",
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        };
        var driver = new Driver { Name = "Refund Driver", LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10], ContactInfo = "+94770000011" };
        db.AddRange(package, tier, booking, guide, vehicle, driver);
        db.VehicleAssignments.Add(new VehicleAssignment { Vehicle = vehicle, Driver = driver, Booking = booking, StartDate = booking.StartDate, EndDate = booking.EndDate });
        for (var d = booking.StartDate; d <= booking.EndDate; d = d.AddDays(1))
        {
            db.GuideAvailabilities.Add(new GuideAvailability { Guide = guide, Date = d, IsAvailable = false, AssignedBookingId = booking.Id });
        }

        var paymentIds = new List<Guid>();
        foreach (var (amount, status) in payments)
        {
            var payment = new Payment
            {
                Booking = booking,
                Amount = amount,
                Status = status,
                SubmittedAt = DateTimeOffset.UtcNow.AddMinutes(paymentIds.Count),
                PaidAt = status is PaymentStatus.DepositPaid or PaymentStatus.FullyPaid ? DateTimeOffset.UtcNow : null
            };
            db.Payments.Add(payment);
            paymentIds.Add(payment.Id);
        }

        await db.SaveChangesAsync();
        return new Seeded(traveler, booking.Id, guide.Id, paymentIds, name);
    }

    private static async Task<(HttpClient Client, string Email, string Name)> TravelerWithEmailAsync(WebApplicationFactory<Program> factory)
    {
        var client = factory.CreateClient();
        var email = $"refund-{Guid.NewGuid():N}@example.com";
        var name = $"Refund Traveler {Guid.NewGuid():N}"[..24];
        await client.PostAsJsonAsync(
            "/api/auth/register", new { Name = name, Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });
        var login = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        login.EnsureSuccessStatusCode();
        var auth = await login.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, email, name);
    }

    private async Task<HttpClient> TravelerClientAsync() => (await TravelerWithEmailAsync(_factory)).Client;

    private async Task<HttpClient> StaffClientAsync(string role)
    {
        if (role == "Traveler")
        {
            return await TravelerClientAsync();
        }

        var client = _factory.CreateClient();
        var email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@example.com";
        var adminLogin = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var admin = await adminLogin.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        using var create = new HttpRequestMessage(HttpMethod.Post, "/api/auth/admin/users")
        {
            Headers = { Authorization = new AuthenticationHeaderValue("Bearer", admin!.Token) },
            Content = JsonContent.Create(new { Name = $"Staff {role}", Email = email, Password = "P@ssword123", ContactNumber = "+14155550101", Role = role })
        };
        (await client.SendAsync(create)).EnsureSuccessStatusCode();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await login.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
