using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Payments;
using TrailWise.Api.Contracts.Reports;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class PaymentsEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public PaymentsEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // 1. Traveler owner can submit qualifying bank transfer
    [Fact]
    public async Task SubmitBankTransfer_TravelerOwner_CanSubmitQualifyingBankTransfer()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        using var form = CreateBankTransferContent(250m);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payment = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.NotNull(payment);
        Assert.Equal(bookingId, payment.BookingId);
        Assert.Equal(250m, payment.Amount);
        Assert.Equal("BankTransfer", payment.Method);
        Assert.Equal("Pending", payment.Status);
        Assert.False(string.IsNullOrWhiteSpace(payment.BankSlipUrl));
    }

    // 2. Card method is no longer accepted
    [Fact]
    public async Task CreatePayment_CardMethod_IsRejectedWithBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var response = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 250m,
            Method = "Card"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Card payments are no longer supported", content);
    }

    // 3. Initial amount below 50% rejected
    [Fact]
    public async Task SubmitBankTransfer_InitialAmountBelow50Percent_ReturnsBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        using var form = CreateBankTransferContent(249.99m);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Initial payment must be at least 50% of the total tour cost", content);
    }

    // 4. Initial amount exactly 50% accepted
    [Fact]
    public async Task SubmitBankTransfer_InitialAmountExactly50Percent_ReturnsCreated()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        using var form = CreateBankTransferContent(250.00m);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payment = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.NotNull(payment);
        Assert.Equal(250m, payment.Amount);
        Assert.Equal("Pending", payment.Status);
    }

    // 5. Initial amount above 50% accepted
    [Fact]
    public async Task SubmitBankTransfer_InitialAmountAbove50Percent_ReturnsCreated()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        using var form = CreateBankTransferContent(350.00m);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payment = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.NotNull(payment);
        Assert.Equal(350m, payment.Amount);
    }

    // 6. Initial amount above total rejected
    [Fact]
    public async Task SubmitBankTransfer_InitialAmountAboveTotal_ReturnsBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        using var form = CreateBankTransferContent(500.01m);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Payment amount cannot exceed the total tour cost", content);
    }

    // 7. Non-owner forbidden
    [Fact]
    public async Task SubmitBankTransfer_NonOwner_ReturnsForbidden()
    {
        var (_, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var otherClient = await AuthenticatedTravelerAsync();
        using var form = CreateBankTransferContent(250m);
        var response = await otherClient.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // 8. Non-confirmed booking rejected
    [Fact]
    public async Task SubmitBankTransfer_NonConfirmedBooking_ReturnsBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m, status: BookingStatus.Requested);

        using var form = CreateBankTransferContent(250m);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Payment can only be recorded for confirmed or completed bookings", content);
    }

    // 9. Missing pricing rejected
    [Fact]
    public async Task SubmitBankTransfer_MissingPricing_ReturnsBadRequest()
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var package = new TourPackage { Name = "No Pricing Tour", Theme = "T", DurationDays = 2, BasePricePerPerson = 100m, MaxGroupSize = 5 };
        var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, IncludesFood = false, BasePricePerPerson = 100m, RequiresAC = false };
        var booking = new Booking
        {
            TravelerId = travelerId,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            BudgetPerPerson = 200m,
            Status = BookingStatus.Confirmed
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        using var form = CreateBankTransferContent(100m);
        var response = await client.PostAsync($"/api/bookings/{booking.Id}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Booking pricing is not available yet", content);
    }

    // 10. Invalid/missing slip rejected
    [Fact]
    public async Task SubmitBankTransfer_MissingSlip_ReturnsBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        using var form = CreateBankTransferContent(250m, includeFile: false);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Bank slip file is required", content);
    }

    // 11. Oversized slip rejected
    [Fact]
    public async Task SubmitBankTransfer_OversizedSlip_ReturnsBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        // 5 MB + 1 byte
        var oversizedBytes = new byte[5 * 1024 * 1024 + 1];
        using var form = CreateBankTransferContent(250m, fileBytes: oversizedBytes, fileName: "slip.jpg", contentType: "image/jpeg");
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Bank slip file must be 5MB or smaller", content);
    }

    // 12. Invalid file type rejected
    [Fact]
    public async Task SubmitBankTransfer_InvalidFileType_ReturnsBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        using var form = CreateBankTransferContent(250m, fileName: "script.exe", contentType: "application/x-msdownload");
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Only JPG, JPEG, PNG, WEBP, or PDF files are allowed", content);
    }

    // 13. Submitted payment status is Pending
    [Fact]
    public async Task SubmitBankTransfer_InitialStatus_IsPending()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        using var form = CreateBankTransferContent(250m);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payment = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.Equal("Pending", payment!.Status);
        Assert.Null(payment.PaidAt);
        Assert.Null(payment.ReviewedAt);
        Assert.Null(payment.ReviewedBy);
    }

    // 14. Pending payment does not count toward TotalPaid
    [Fact]
    public async Task GetPaymentStatus_WhenPaymentIsPending_DoesNotCountTowardTotalPaid()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        using var form = CreateBankTransferContent(250m);
        var submitRes = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
        Assert.Equal(HttpStatusCode.Created, submitRes.StatusCode);

        var statusRes = await client.GetAsync($"/api/bookings/{bookingId}/payment-status");
        Assert.Equal(HttpStatusCode.OK, statusRes.StatusCode);
        var status = await statusRes.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);
        Assert.NotNull(status);
        Assert.Equal(0m, status.TotalPaid);
        Assert.Equal(500m, status.RemainingAmount);
        Assert.Equal("Pending", status.Status);
        Assert.True(status.HasPendingVerification);
    }

    // 15. Second submission while Pending returns 409
    [Fact]
    public async Task SubmitBankTransfer_SecondSubmissionWhilePending_ReturnsConflict()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        using (var form1 = CreateBankTransferContent(250m))
        {
            var res1 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form1);
            Assert.Equal(HttpStatusCode.Created, res1.StatusCode);
        }

        using (var form2 = CreateBankTransferContent(250m))
        {
            var res2 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form2);
            Assert.Equal(HttpStatusCode.Conflict, res2.StatusCode);
            var content = await res2.Content.ReadAsStringAsync();
            Assert.Contains("A bank transfer slip is already pending review for this booking", content);
        }
    }

    // 16. OperationsManager can list pending payments
    [Fact]
    public async Task GetPendingPayments_AsOperationsManager_ReturnsListWithPendingPayments()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        using (var form = CreateBankTransferContent(250m))
        {
            await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
        }

        var opsClient = await AuthenticatedOperationsManagerAsync();
        var response = await opsClient.GetAsync("/api/payments/pending");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = await response.Content.ReadFromJsonAsync<List<PendingPaymentDto>>(JsonOptions);
        Assert.NotNull(list);
        Assert.Contains(list, p => p.BookingId == bookingId && p.Status == "Pending");
    }

    // 17. Traveler cannot list pending payments
    [Fact]
    public async Task GetPendingPayments_AsTraveler_ReturnsForbidden()
    {
        var (client, _, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var response = await client.GetAsync("/api/payments/pending");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // 18. OperationsManager can approve
    [Fact]
    public async Task ApprovePayment_AsOperationsManager_ReturnsOk()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var opsClient = await AuthenticatedOperationsManagerAsync();
        var response = await opsClient.PostAsync($"/api/payments/{paymentId}/approve", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var approved = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.Equal("DepositPaid", approved!.Status);
    }

    // 19. Admin can approve
    [Fact]
    public async Task ApprovePayment_AsAdmin_ReturnsOk()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        var response = await adminClient.PostAsync($"/api/payments/{paymentId}/approve", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var approved = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.Equal("DepositPaid", approved!.Status);
    }

    // 20. Approval below full total -> DepositPaid
    [Fact]
    public async Task ApprovePayment_BelowFullTotal_SetsDepositPaid()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        var response = await adminClient.PostAsync($"/api/payments/{paymentId}/approve", null);
        var approved = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);

        Assert.Equal("DepositPaid", approved!.Status);

        var statusRes = await client.GetAsync($"/api/bookings/{bookingId}/payment-status");
        var status = await statusRes.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);
        Assert.Equal("DepositPaid", status!.Status);
        Assert.Equal(250m, status.TotalPaid);
        Assert.Equal(250m, status.RemainingAmount);
    }

    // 21. Approval reaching full total -> FullyPaid
    [Fact]
    public async Task ApprovePayment_ReachingFullTotal_SetsFullyPaid()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        Guid paymentId;
        using (var form = CreateBankTransferContent(500m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        var response = await adminClient.PostAsync($"/api/payments/{paymentId}/approve", null);
        var approved = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);

        Assert.Equal("FullyPaid", approved!.Status);

        var statusRes = await client.GetAsync($"/api/bookings/{bookingId}/payment-status");
        var status = await statusRes.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);
        Assert.Equal("FullyPaid", status!.Status);
        Assert.Equal(500m, status.TotalPaid);
        Assert.Equal(0m, status.RemainingAmount);
    }

    // 22. Approval sets PaidAt
    [Fact]
    public async Task ApprovePayment_SetsPaidAt()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        var response = await adminClient.PostAsync($"/api/payments/{paymentId}/approve", null);
        var approved = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);

        Assert.NotNull(approved!.PaidAt);
        Assert.True(approved.PaidAt > DateTimeOffset.UtcNow.AddMinutes(-5));
    }

    // 23. Approval sets ReviewedAt/ReviewedBy
    [Fact]
    public async Task ApprovePayment_SetsReviewedAtAndReviewedBy()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        var response = await adminClient.PostAsync($"/api/payments/{paymentId}/approve", null);
        var approved = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);

        Assert.NotNull(approved!.ReviewedAt);
        Assert.NotNull(approved.ReviewedBy);
        Assert.True(approved.ReviewedAt > DateTimeOffset.UtcNow.AddMinutes(-5));
    }

    // 24. Reject sets Failed
    [Fact]
    public async Task RejectPayment_SetsFailedStatus()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        var response = await adminClient.PostAsJsonAsync($"/api/payments/{paymentId}/reject", new { Reason = "Blurry bank slip receipt" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var rejected = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.Equal("Failed", rejected!.Status);
        Assert.Null(rejected.PaidAt);
        Assert.NotNull(rejected.ReviewedAt);
        Assert.NotNull(rejected.ReviewedBy);
    }

    // 25. Reject stores rejection reason
    [Fact]
    public async Task RejectPayment_StoresRejectionReason()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        var response = await adminClient.PostAsJsonAsync($"/api/payments/{paymentId}/reject", new { Reason = "Payment reference not matching" });

        var rejected = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.Equal("Payment reference not matching", rejected!.RejectionReason);
    }

    // 26. Failed payment does not count toward TotalPaid
    [Fact]
    public async Task GetPaymentStatus_WhenPaymentIsFailed_DoesNotCountTowardTotalPaid()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        await adminClient.PostAsJsonAsync($"/api/payments/{paymentId}/reject", new { Reason = "Invalid" });

        var statusRes = await client.GetAsync($"/api/bookings/{bookingId}/payment-status");
        var status = await statusRes.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);

        Assert.Equal(0m, status!.TotalPaid);
        Assert.Equal(500m, status.RemainingAmount);
        Assert.Equal("Unpaid", status.Status);
        Assert.False(status.HasPendingVerification);
        Assert.Equal("Invalid", status.LatestRejectedPaymentReason);
        Assert.NotNull(status.LatestRejectedAt);
        Assert.Equal(paymentId, status.LatestRejectedPaymentId);
    }

    // 27. Subsequent approved balance payment may be less than 50%
    [Fact]
    public async Task SubmitBankTransfer_SubsequentPaymentAfterDeposit_MayBeLessThan50Percent()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        // First payment $300 (60%)
        Guid firstPaymentId;
        using (var form1 = CreateBankTransferContent(300m))
        {
            var res1 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form1);
            var p1 = await res1.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            firstPaymentId = p1!.Id;
        }

        // Approve first payment
        var adminClient = await AuthenticatedAdminAsync();
        await adminClient.PostAsync($"/api/payments/{firstPaymentId}/approve", null);

        // Second payment $100 (20% of total tour cost)
        using (var form2 = CreateBankTransferContent(100m))
        {
            var res2 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form2);
            Assert.Equal(HttpStatusCode.Created, res2.StatusCode);
            var p2 = await res2.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            Assert.Equal(100m, p2!.Amount);
            Assert.Equal("Pending", p2.Status);
        }
    }

    // 28. Subsequent payment cannot exceed remaining balance
    [Fact]
    public async Task SubmitBankTransfer_SubsequentPaymentExceedingRemainingBalance_ReturnsBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        // First payment $300 (remaining balance: $200)
        Guid firstPaymentId;
        using (var form1 = CreateBankTransferContent(300m))
        {
            var res1 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form1);
            var p1 = await res1.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            firstPaymentId = p1!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        await adminClient.PostAsync($"/api/payments/{firstPaymentId}/approve", null);

        // Second payment $200.01 (exceeds $200 remaining balance)
        using (var form2 = CreateBankTransferContent(200.01m))
        {
            var res2 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form2);
            Assert.Equal(HttpStatusCode.BadRequest, res2.StatusCode);
            var content = await res2.Content.ReadAsStringAsync();
            Assert.Contains("Payment amount exceeds the remaining balance", content);
        }
    }

    // 29. Audit BankTransferSubmitted created
    [Fact]
    public async Task SubmitBankTransfer_CreatesAuditLogBankTransferSubmitted()
    {
        var (client, bookingId, travelerId) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.EntityType == "Payment" && a.EntityId == paymentId && a.Action == "BankTransferSubmitted");
        Assert.NotNull(audit);
        Assert.Equal(travelerId, audit.PerformedBy);
    }

    // 30. Audit PaymentApproved created
    [Fact]
    public async Task ApprovePayment_CreatesAuditLogPaymentApproved()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        await adminClient.PostAsync($"/api/payments/{paymentId}/approve", null);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.EntityType == "Payment" && a.EntityId == paymentId && a.Action == "PaymentApproved");
        Assert.NotNull(audit);
    }

    // 31. Audit PaymentRejected created
    [Fact]
    public async Task RejectPayment_CreatesAuditLogPaymentRejected()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        await adminClient.PostAsJsonAsync($"/api/payments/{paymentId}/reject", new { Reason = "Invalid slip" });

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.EntityType == "Payment" && a.EntityId == paymentId && a.Action == "PaymentRejected");
        Assert.NotNull(audit);
        Assert.Contains("Invalid slip", audit.Details);
    }

    // 32. Revenue report still includes approved payments
    [Fact]
    public async Task RevenueReport_IncludesApprovedPayments()
    {
        var adminClient = await AuthenticatedAdminAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var baselineResponse = await adminClient.GetAsync($"/api/reports/revenue?from={today.AddDays(-1):yyyy-MM-dd}&to={today.AddDays(1):yyyy-MM-dd}");
        var baselineReport = await baselineResponse.Content.ReadFromJsonAsync<RevenueReportResponse>(JsonOptions);
        var baselineRevenue = baselineReport!.TotalRevenue;

        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        Guid paymentId;
        using (var form = CreateBankTransferContent(300m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        await adminClient.PostAsync($"/api/payments/{paymentId}/approve", null);

        var revResponse = await adminClient.GetAsync($"/api/reports/revenue?from={today.AddDays(-1):yyyy-MM-dd}&to={today.AddDays(1):yyyy-MM-dd}");
        Assert.Equal(HttpStatusCode.OK, revResponse.StatusCode);

        var report = await revResponse.Content.ReadFromJsonAsync<RevenueReportResponse>(JsonOptions);
        Assert.NotNull(report);
        Assert.Equal(baselineRevenue + 300m, report.TotalRevenue);
    }

    // 33. Revenue report excludes Pending/Failed payments
    [Fact]
    public async Task RevenueReport_ExcludesPendingAndFailedPayments()
    {
        var adminClient = await AuthenticatedAdminAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var baselineResponse = await adminClient.GetAsync($"/api/reports/revenue?from={today.AddDays(-1):yyyy-MM-dd}&to={today.AddDays(1):yyyy-MM-dd}");
        var baselineReport = await baselineResponse.Content.ReadFromJsonAsync<RevenueReportResponse>(JsonOptions);
        var baselineRevenue = baselineReport!.TotalRevenue;

        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        // Submit pending payment
        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        // 1. Check revenue when payment is Pending (should equal baselineRevenue)
        var revPendingResponse = await adminClient.GetAsync($"/api/reports/revenue?from={today.AddDays(-1):yyyy-MM-dd}&to={today.AddDays(1):yyyy-MM-dd}");
        var reportPending = await revPendingResponse.Content.ReadFromJsonAsync<RevenueReportResponse>(JsonOptions);
        Assert.Equal(baselineRevenue, reportPending!.TotalRevenue);

        // 2. Reject payment to make it Failed (should still equal baselineRevenue)
        await adminClient.PostAsJsonAsync($"/api/payments/{paymentId}/reject", new { Reason = "Rejected for testing" });

        var revFailedResponse = await adminClient.GetAsync($"/api/reports/revenue?from={today.AddDays(-1):yyyy-MM-dd}&to={today.AddDays(1):yyyy-MM-dd}");
        var reportFailed = await revFailedResponse.Content.ReadFromJsonAsync<RevenueReportResponse>(JsonOptions);
        Assert.Equal(baselineRevenue, reportFailed!.TotalRevenue);
    }

    // Additional: GetPaymentStatus as Manager/Admin returns Unpaid when 0 payments
    [Fact]
    public async Task GetPaymentStatus_AsManagerOrAdmin_ReturnsOkWithUnpaidStatus()
    {
        var (_, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var adminClient = await AuthenticatedAdminAsync();
        var response = await adminClient.GetAsync($"/api/bookings/{bookingId}/payment-status");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var status = await response.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);
        Assert.Equal(500m, status!.TotalCost);
        Assert.Equal(0m, status.TotalPaid);
        Assert.Equal(500m, status.RemainingAmount);
        Assert.Equal("Unpaid", status.Status);
        Assert.False(status.HasPendingVerification);
        Assert.Equal(250m, status.MinimumAdvance);
    }

    // Additional: GetPaymentStatus as unrelated traveler returns Forbidden
    [Fact]
    public async Task GetPaymentStatus_AsUnrelatedTraveler_ReturnsForbidden()
    {
        var (_, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var otherClient = await AuthenticatedTravelerAsync();
        var response = await otherClient.GetAsync($"/api/bookings/{bookingId}/payment-status");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // Additional: GetPaymentById returns Ok for owner and staff
    [Fact]
    public async Task GetPaymentById_AsOwnerAndStaff_ReturnsOk()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        Guid paymentId;
        using (var form = CreateBankTransferContent(250m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        // Owner can access
        var ownerRes = await client.GetAsync($"/api/payments/{paymentId}");
        Assert.Equal(HttpStatusCode.OK, ownerRes.StatusCode);
        var ownerPayment = await ownerRes.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.Equal(paymentId, ownerPayment!.Id);

        // Admin can access
        var adminClient = await AuthenticatedAdminAsync();
        var adminRes = await adminClient.GetAsync($"/api/payments/{paymentId}");
        Assert.Equal(HttpStatusCode.OK, adminRes.StatusCode);

        // Unrelated traveler is forbidden
        var otherClient = await AuthenticatedTravelerAsync();
        var otherRes = await otherClient.GetAsync($"/api/payments/{paymentId}");
        Assert.Equal(HttpStatusCode.Forbidden, otherRes.StatusCode);
    }

    // Additional: Already fully paid booking rejects new submission with 409
    [Fact]
    public async Task SubmitBankTransfer_WhenAlreadyFullyPaid_ReturnsConflict()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        Guid paymentId;
        using (var form = CreateBankTransferContent(500m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        await adminClient.PostAsync($"/api/payments/{paymentId}/approve", null);

        using var form2 = CreateBankTransferContent(50m);
        var res2 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form2);
        Assert.Equal(HttpStatusCode.Conflict, res2.StatusCode);
        var content = await res2.Content.ReadAsStringAsync();
        Assert.Contains("Booking is already fully paid", content);
    }

    // 37. Latest rejection reason and timestamp are returned
    [Fact]
    public async Task GetPaymentStatus_WhenPaymentRejected_ReturnsRejectionReasonAndTimestamp()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 600m);
        Guid paymentId;
        using (var form = CreateBankTransferContent(300m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }

        var adminClient = await AuthenticatedAdminAsync();
        var rejectRes = await adminClient.PostAsJsonAsync($"/api/payments/{paymentId}/reject", new { Reason = "Bank slip is unreadable" });
        Assert.Equal(HttpStatusCode.OK, rejectRes.StatusCode);

        var statusRes = await client.GetAsync($"/api/bookings/{bookingId}/payment-status");
        var status = await statusRes.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);

        Assert.NotNull(status);
        Assert.Equal("Bank slip is unreadable", status.LatestRejectedPaymentReason);
        Assert.NotNull(status.LatestRejectedAt);
        Assert.Equal(paymentId, status.LatestRejectedPaymentId);
    }

    // 38. Most recent failed payment wins when multiple failed payments exist
    [Fact]
    public async Task GetPaymentStatus_WhenMultipleFailedPaymentsExist_ReturnsMostRecentRejection()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 600m);
        var adminClient = await AuthenticatedAdminAsync();

        // First payment rejected
        Guid payment1Id;
        using (var form1 = CreateBankTransferContent(300m))
        {
            var res1 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form1);
            var p1 = await res1.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            payment1Id = p1!.Id;
        }
        await adminClient.PostAsJsonAsync($"/api/payments/{payment1Id}/reject", new { Reason = "First attempt blurry" });

        // Second payment rejected with different reason
        Guid payment2Id;
        using (var form2 = CreateBankTransferContent(300m))
        {
            var res2 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form2);
            var p2 = await res2.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            payment2Id = p2!.Id;
        }
        await adminClient.PostAsJsonAsync($"/api/payments/{payment2Id}/reject", new { Reason = "Second attempt invalid account number" });

        var statusRes = await client.GetAsync($"/api/bookings/{bookingId}/payment-status");
        var status = await statusRes.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);

        Assert.NotNull(status);
        Assert.Equal("Second attempt invalid account number", status.LatestRejectedPaymentReason);
        Assert.Equal(payment2Id, status.LatestRejectedPaymentId);
    }

    // 39. No failed payments returns null rejection fields
    [Fact]
    public async Task GetPaymentStatus_WhenNoFailedPayments_ReturnsNullRejectionFields()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var statusRes = await client.GetAsync($"/api/bookings/{bookingId}/payment-status");
        var status = await statusRes.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);

        Assert.NotNull(status);
        Assert.Null(status.LatestRejectedPaymentReason);
        Assert.Null(status.LatestRejectedAt);
        Assert.Null(status.LatestRejectedPaymentId);
    }

    // 40. Existing DepositPaid status remains DepositPaid even when a later payment failed
    [Fact]
    public async Task GetPaymentStatus_WhenDepositPaidAndLaterPaymentFailed_StatusRemainsDepositPaid()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 600m);
        var adminClient = await AuthenticatedAdminAsync();

        // 1. Submit and approve first payment ($300)
        Guid firstPaymentId;
        using (var form1 = CreateBankTransferContent(300m))
        {
            var res1 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form1);
            var p1 = await res1.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            firstPaymentId = p1!.Id;
        }
        await adminClient.PostAsync($"/api/payments/{firstPaymentId}/approve", null);

        // 2. Submit second payment ($150) and reject it
        Guid secondPaymentId;
        using (var form2 = CreateBankTransferContent(150m))
        {
            var res2 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form2);
            var p2 = await res2.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            secondPaymentId = p2!.Id;
        }
        await adminClient.PostAsJsonAsync($"/api/payments/{secondPaymentId}/reject", new { Reason = "Transferred amount does not match slip" });

        // 3. Fetch status
        var statusRes = await client.GetAsync($"/api/bookings/{bookingId}/payment-status");
        var status = await statusRes.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);

        Assert.NotNull(status);
        Assert.Equal("DepositPaid", status.Status);
        Assert.Equal(300m, status.TotalPaid);
        Assert.Equal(300m, status.RemainingAmount);
        Assert.False(status.HasPendingVerification);
        Assert.Equal("Transferred amount does not match slip", status.LatestRejectedPaymentReason);
        Assert.Equal(secondPaymentId, status.LatestRejectedPaymentId);
        Assert.NotNull(status.LatestRejectedAt);
    }

    // 41. FullyPaid calculation unchanged
    [Fact]
    public async Task GetPaymentStatus_WhenFullyPaid_CalculationRemainsUnchanged()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        var adminClient = await AuthenticatedAdminAsync();

        Guid paymentId;
        using (var form = CreateBankTransferContent(500m))
        {
            var res = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
            var p = await res.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p!.Id;
        }
        await adminClient.PostAsync($"/api/payments/{paymentId}/approve", null);

        var statusRes = await client.GetAsync($"/api/bookings/{bookingId}/payment-status");
        var status = await statusRes.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);

        Assert.NotNull(status);
        Assert.Equal("FullyPaid", status.Status);
        Assert.Equal(500m, status.TotalPaid);
        Assert.Equal(0m, status.RemainingAmount);
        Assert.False(status.HasPendingVerification);
    }

    // 42. Completed + DepositPaid + remaining > 0 accepts balance slip
    [Fact]
    public async Task SubmitBankTransfer_CompletedBooking_WithRemainingBalance_AcceptsBalanceSlip()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        var adminClient = await AuthenticatedAdminAsync();

        // Deposit payment of $250
        Guid depositId;
        using (var form1 = CreateBankTransferContent(250m))
        {
            var res1 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form1);
            var p1 = await res1.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            depositId = p1!.Id;
        }
        await adminClient.PostAsync($"/api/payments/{depositId}/approve", null);

        // Mark completed
        await SetBookingStatusAsync(bookingId, BookingStatus.Completed);

        // Submit remaining balance ($250)
        using var form2 = CreateBankTransferContent(250m);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form2);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payment = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.NotNull(payment);
        Assert.Equal(250m, payment.Amount);
        Assert.Equal("Pending", payment.Status);
    }

    // 43. Completed + FullyPaid rejects extra payment
    [Fact]
    public async Task SubmitBankTransfer_CompletedBooking_FullyPaid_RejectsExtraPayment()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        var adminClient = await AuthenticatedAdminAsync();

        // Full payment
        Guid paymentId;
        using (var form1 = CreateBankTransferContent(500m))
        {
            var res1 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form1);
            var p1 = await res1.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            paymentId = p1!.Id;
        }
        await adminClient.PostAsync($"/api/payments/{paymentId}/approve", null);

        // Mark completed
        await SetBookingStatusAsync(bookingId, BookingStatus.Completed);

        // Attempt another payment
        using var form2 = CreateBankTransferContent(100m);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form2);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("already fully paid", content);
    }

    // 44. Completed + Pending verification rejects another submission
    [Fact]
    public async Task SubmitBankTransfer_CompletedBooking_PendingVerification_RejectsAnotherSubmission()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);
        var adminClient = await AuthenticatedAdminAsync();

        // Deposit payment of $250
        Guid depositId;
        using (var form1 = CreateBankTransferContent(250m))
        {
            var res1 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form1);
            var p1 = await res1.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            depositId = p1!.Id;
        }
        await adminClient.PostAsync($"/api/payments/{depositId}/approve", null);

        // Mark completed
        await SetBookingStatusAsync(bookingId, BookingStatus.Completed);

        // Submit balance payment -> now Pending
        using (var form2 = CreateBankTransferContent(250m))
        {
            var res2 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form2);
            Assert.Equal(HttpStatusCode.Created, res2.StatusCode);
        }

        // Attempt second balance payment while pending
        using var form3 = CreateBankTransferContent(250m);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form3);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("pending review", content);
    }

    // 45. Completed + rejected prior balance allows retry
    [Fact]
    public async Task SubmitBankTransfer_CompletedBooking_RejectedPriorBalance_AllowsRetry()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 600m);
        var adminClient = await AuthenticatedAdminAsync();

        // Deposit payment of $300
        Guid depositId;
        using (var form1 = CreateBankTransferContent(300m))
        {
            var res1 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form1);
            var p1 = await res1.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            depositId = p1!.Id;
        }
        await adminClient.PostAsync($"/api/payments/{depositId}/approve", null);

        // Mark completed
        await SetBookingStatusAsync(bookingId, BookingStatus.Completed);

        // Submit balance payment of $300 and reject it
        Guid balancePaymentId;
        using (var form2 = CreateBankTransferContent(300m))
        {
            var res2 = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form2);
            var p2 = await res2.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
            balancePaymentId = p2!.Id;
        }
        await adminClient.PostAsJsonAsync($"/api/payments/{balancePaymentId}/reject", new { Reason = "Unclear transfer image" });

        // Retry balance payment
        using var form3 = CreateBankTransferContent(300m);
        var retryResponse = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form3);

        Assert.Equal(HttpStatusCode.Created, retryResponse.StatusCode);
        var retryPayment = await retryResponse.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.NotNull(retryPayment);
        Assert.Equal(300m, retryPayment.Amount);
        Assert.Equal("Pending", retryPayment.Status);
    }

    // 46. Cancelled booking rejects payment
    [Fact]
    public async Task SubmitBankTransfer_CancelledBooking_ReturnsBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m, status: BookingStatus.Cancelled);

        using var form = CreateBankTransferContent(250m);
        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Payment can only be recorded for confirmed or completed bookings", content);
    }

    private async Task SetBookingStatusAsync(Guid bookingId, BookingStatus status)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var b = await db.Bookings.FindAsync(bookingId);
        b!.Status = status;
        await db.SaveChangesAsync();
    }

    private static MultipartFormDataContent CreateBankTransferContent(
        decimal amount,
        byte[]? fileBytes = null,
        string fileName = "slip.jpg",
        string contentType = "image/jpeg",
        string fieldName = "bankSlip",
        bool includeFile = true)
    {
        var content = new MultipartFormDataContent();
        content.Add(new StringContent(amount.ToString(System.Globalization.CultureInfo.InvariantCulture)), "amount");

        if (includeFile)
        {
            fileBytes ??= new byte[] { 0xFF, 0xD8, 0xFF, 0x00, 0x01 };
            var fileContent = new ByteArrayContent(fileBytes);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            content.Add(fileContent, fieldName, fileName);
        }

        return content;
    }

    private async Task<(HttpClient Client, Guid BookingId, Guid TravelerId)> SetupConfirmedBookingWithPricingAsync(
        decimal totalCost,
        BookingStatus status = BookingStatus.Confirmed)
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var package = new TourPackage
        {
            Name = "Payment Test Tour",
            Theme = "Test",
            DurationDays = 3,
            BasePricePerPerson = 250m,
            MaxGroupSize = 10
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = false,
            BasePricePerPerson = 250m,
            RequiresAC = false
        };
        var booking = new Booking
        {
            TravelerId = travelerId,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(13)),
            BudgetPerPerson = 500m,
            Status = status
        };

        db.Bookings.Add(booking);

        var run = new AgentWorkflowRun
        {
            Booking = booking,
            Objective = "Pricing Test",
            Status = "Completed",
            StartedAt = DateTimeOffset.UtcNow
        };
        db.AgentWorkflowRuns.Add(run);

        var stepLog = new AgentStepLog
        {
            WorkflowRun = run,
            AgentName = "PricingValidationAgent",
            InputJson = JsonSerializer.Serialize(new { bookingId = booking.Id }),
            OutputJson = JsonSerializer.Serialize(new
            {
                totalCost,
                breakdown = "{}",
                validationResult = "Valid"
            }),
            DurationMs = 10
        };
        db.AgentStepLogs.Add(stepLog);

        await db.SaveChangesAsync();

        return (client, booking.Id, travelerId);
    }

    private async Task<(HttpClient Client, Guid TravelerId)> AuthenticatedTravelerWithIdAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Traveler T", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<HttpClient> AuthenticatedTravelerAsync()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        return client;
    }

    private async Task<HttpClient> AuthenticatedAdminAsync()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<HttpClient> AuthenticatedOperationsManagerAsync()
    {
        var client = _factory.CreateClient();
        var adminClient = await AuthenticatedAdminAsync();

        var opsEmail = $"ops-{Guid.NewGuid():N}@example.com";
        var createResponse = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Ops Manager",
            Email = opsEmail,
            Password = "P@ssword123",
            ContactNumber = "+14155550101",
            Role = "OperationsManager"
        });
        createResponse.EnsureSuccessStatusCode();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = opsEmail, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
