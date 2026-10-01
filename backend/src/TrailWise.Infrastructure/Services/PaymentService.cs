using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class PaymentService : IPaymentService
{
    private readonly TrailWiseDbContext _db;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<PaymentService> _logger;
    private readonly IClock _clock;

    public PaymentService(
        TrailWiseDbContext db,
        IAuditLogService auditLogService,
        ILogger<PaymentService> logger,
        IClock? clock = null)
    {
        _db = db;
        _auditLogService = auditLogService;
        _logger = logger;
        _clock = clock ?? new SystemClock();
    }

    public async Task<SubmitBankTransferResult> SubmitBankTransferAsync(
        Guid bookingId,
        decimal amount,
        string bankSlipUrl,
        Guid travelerId,
        CancellationToken ct = default)
    {
        var booking = await _db.Bookings
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking is null)
        {
            return SubmitBankTransferResult.Failure("Booking not found.", 404);
        }

        if (booking.TravelerId != travelerId)
        {
            return SubmitBankTransferResult.Failure("Forbidden. You may only pay for your own booking.", 403);
        }

        if (booking.Status != BookingStatus.Confirmed && booking.Status != BookingStatus.Completed)
        {
            return SubmitBankTransferResult.Failure("Payment can only be recorded for confirmed or completed bookings.", 400);
        }

        var totalCost = await GetAuthoritativeTotalCostAsync(bookingId, ct);
        if (!totalCost.HasValue)
        {
            return SubmitBankTransferResult.Failure("Booking pricing is not available yet.", 400);
        }

        var approvedTotal = booking.Payments
            .Where(p => p.Status == PaymentStatus.DepositPaid || p.Status == PaymentStatus.FullyPaid)
            .Sum(p => p.Amount);

        if (approvedTotal >= totalCost.Value)
        {
            return SubmitBankTransferResult.Failure("Booking is already fully paid.", 409);
        }

        var hasPending = booking.Payments.Any(p => p.Status == PaymentStatus.Pending);
        if (hasPending)
        {
            return SubmitBankTransferResult.Failure("A bank transfer slip is already pending review for this booking.", 409);
        }

        var remainingBalance = totalCost.Value - approvedTotal;
        var hasApprovedPayment = booking.Payments.Any(p => p.Status == PaymentStatus.DepositPaid || p.Status == PaymentStatus.FullyPaid);
        var now = _clock.UtcNow;

        if (booking.Status == BookingStatus.Completed)
        {
            if (booking.BalancePaymentDueAt.HasValue && now >= booking.BalancePaymentDueAt.Value)
            {
                return SubmitBankTransferResult.Failure("Final payment deadline has expired. Please contact support.", 400);
            }
        }

        if (booking.Status == BookingStatus.Confirmed && !hasApprovedPayment)
        {
            if (booking.PaymentDueAt.HasValue && now > booking.PaymentDueAt.Value)
            {
                var hasQualifying = booking.Payments.Any(p =>
                    p.SubmittedAt <= booking.PaymentDueAt.Value &&
                    (p.Status == PaymentStatus.Pending || p.Status == PaymentStatus.DepositPaid || p.Status == PaymentStatus.FullyPaid));

                if (!hasQualifying)
                {
                    if (booking.Status == BookingStatus.Confirmed)
                    {
                        var prevStatus = booking.Status.ToString();
                        booking.Status = BookingStatus.Cancelled;
                        booking.PaymentExpiredAt = now;
                        booking.CancellationReason = "Advance payment was not submitted within the required 1-hour period.";

                        await using var expiryTransaction = _db.Database.IsRelational()
                            ? await _db.Database.BeginTransactionAsync(ct)
                            : null;

                        try
                        {
                            await _db.SaveChangesAsync(ct);

                            await _auditLogService.LogAsync(
                                entityType: "Booking",
                                entityId: booking.Id,
                                action: "BookingPaymentExpired",
                                performedBy: travelerId,
                                details: new
                                {
                                    bookingId = booking.Id,
                                    travelerId = booking.TravelerId,
                                    tourPackageId = booking.TourPackageId,
                                    paymentDueAt = booking.PaymentDueAt,
                                    expiredAt = booking.PaymentExpiredAt,
                                    previousStatus = prevStatus,
                                    newStatus = booking.Status.ToString(),
                                    reason = booking.CancellationReason
                                },
                                ct: ct);

                            if (expiryTransaction != null)
                            {
                                await expiryTransaction.CommitAsync(ct);
                            }
                        }
                        catch
                        {
                            if (expiryTransaction != null)
                            {
                                await expiryTransaction.RollbackAsync(ct);
                            }
                            throw;
                        }
                    }

                    return SubmitBankTransferResult.Failure("Advance payment deadline has expired.", 409);
                }
            }

            var minimumAdvance = Math.Round(totalCost.Value * 0.50m, 2, MidpointRounding.AwayFromZero);
            if (amount < minimumAdvance)
            {
                return SubmitBankTransferResult.Failure("Initial payment must be at least 50% of the total tour cost.", 400);
            }

            if (amount > totalCost.Value)
            {
                return SubmitBankTransferResult.Failure("Payment amount cannot exceed the total tour cost.", 400);
            }
        }
        else
        {
            if (amount <= 0)
            {
                return SubmitBankTransferResult.Failure("Payment amount must be greater than 0.", 400);
            }

            if (amount > remainingBalance)
            {
                return SubmitBankTransferResult.Failure("Payment amount exceeds the remaining balance.", 400);
            }
        }

        var payment = new Payment
        {
            BookingId = bookingId,
            Amount = amount,
            Method = "BankTransfer",
            BankSlipUrl = bankSlipUrl,
            SubmittedAt = now,
            PaidAt = null,
            Status = PaymentStatus.Pending,
            ReviewedAt = null,
            ReviewedBy = null,
            RejectionReason = null
        };

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            _db.Payments.Add(payment);
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Payment",
                entityId: payment.Id,
                action: "BankTransferSubmitted",
                performedBy: travelerId,
                details: new
                {
                    bookingId,
                    amount,
                    method = "BankTransfer",
                    bankSlipUrl,
                    submittedAt = payment.SubmittedAt
                },
                ct: ct);

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        _logger.LogInformation("Bank transfer payment of {Amount} submitted for booking {BookingId}. Initial status: Pending",
            amount, bookingId);

        return SubmitBankTransferResult.Success(payment);
    }

    public async Task<IReadOnlyList<Payment>> GetPendingPaymentsAsync(CancellationToken ct = default)
    {
        return await _db.Payments
            .AsNoTracking()
            .Include(p => p.Booking)
                .ThenInclude(b => b.Traveler)
            .Include(p => p.Booking)
                .ThenInclude(b => b.TourPackage)
            .Where(p => p.Status == PaymentStatus.Pending)
            .OrderBy(p => p.SubmittedAt)
            .ToListAsync(ct);
    }

    public async Task<PaymentDetailResult> GetPaymentByIdAsync(
        Guid paymentId,
        Guid requestingUserId,
        bool isManagerOrAdmin,
        CancellationToken ct = default)
    {
        var payment = await _db.Payments
            .AsNoTracking()
            .Include(p => p.Booking)
            .FirstOrDefaultAsync(p => p.Id == paymentId, ct);

        if (payment is null)
        {
            return PaymentDetailResult.Failure("Payment not found.", 404);
        }

        var isOwner = payment.Booking?.TravelerId == requestingUserId;
        if (!isOwner && !isManagerOrAdmin)
        {
            return PaymentDetailResult.Failure("Forbidden. You do not have access to view this payment.", 403);
        }

        return PaymentDetailResult.Success(payment);
    }

    public async Task<ApprovePaymentResult> ApprovePaymentAsync(
        Guid paymentId,
        Guid staffUserId,
        CancellationToken ct = default)
    {
        var payment = await _db.Payments
            .Include(p => p.Booking)
                .ThenInclude(b => b.Payments)
            .FirstOrDefaultAsync(p => p.Id == paymentId, ct);

        if (payment is null)
        {
            return ApprovePaymentResult.Failure("Payment not found.", 404);
        }

        if (payment.Status != PaymentStatus.Pending)
        {
            return ApprovePaymentResult.Failure("Only pending payments can be approved.", 400);
        }

        var totalCost = await GetAuthoritativeTotalCostAsync(payment.BookingId, ct);
        if (!totalCost.HasValue)
        {
            return ApprovePaymentResult.Failure("Booking pricing is not available yet.", 400);
        }

        var previousApprovedTotal = payment.Booking.Payments
            .Where(p => (p.Status == PaymentStatus.DepositPaid || p.Status == PaymentStatus.FullyPaid) && p.Id != payment.Id)
            .Sum(p => p.Amount);

        var newApprovedTotal = previousApprovedTotal + payment.Amount;
        var resultingStatus = newApprovedTotal >= totalCost.Value
            ? PaymentStatus.FullyPaid
            : PaymentStatus.DepositPaid;

        var now = _clock.UtcNow;
        payment.Status = resultingStatus;
        payment.PaidAt = now;
        payment.ReviewedAt = now;
        payment.ReviewedBy = staffUserId;
        payment.RejectionReason = null;

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Payment",
                entityId: payment.Id,
                action: "PaymentApproved",
                performedBy: staffUserId,
                details: new
                {
                    bookingId = payment.BookingId,
                    amount = payment.Amount,
                    resultingStatus = resultingStatus.ToString(),
                    previousApprovedTotal,
                    newApprovedTotal,
                    reviewedAt = payment.ReviewedAt
                },
                ct: ct);

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        _logger.LogInformation("Payment {PaymentId} approved for booking {BookingId}. New status: {Status}",
            payment.Id, payment.BookingId, resultingStatus);

        return ApprovePaymentResult.Success(payment);
    }

    public async Task<RejectPaymentResult> RejectPaymentAsync(
        Guid paymentId,
        string reason,
        Guid staffUserId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            return RejectPaymentResult.Failure("Rejection reason is required.", 400);
        }

        if (reason.Length > 500)
        {
            return RejectPaymentResult.Failure("Rejection reason cannot exceed 500 characters.", 400);
        }

        var payment = await _db.Payments
            .Include(p => p.Booking)
                .ThenInclude(b => b.Payments)
            .FirstOrDefaultAsync(p => p.Id == paymentId, ct);

        if (payment is null)
        {
            return RejectPaymentResult.Failure("Payment not found.", 404);
        }

        if (payment.Status != PaymentStatus.Pending)
        {
            return RejectPaymentResult.Failure("Only pending payments can be rejected.", 400);
        }

        var now = _clock.UtcNow;
        payment.Status = PaymentStatus.Failed;
        payment.ReviewedAt = now;
        payment.ReviewedBy = staffUserId;
        payment.PaidAt = null;
        payment.RejectionReason = reason;

        var booking = payment.Booking;
        bool bookingExpired = false;
        string? prevBookingStatus = null;

        if (booking != null && booking.Status == BookingStatus.Confirmed && booking.PaymentDueAt.HasValue && booking.PaymentDueAt.Value < now)
        {
            var hasApprovedPayment = booking.Payments
                .Any(p => p.Id != payment.Id && (p.Status == PaymentStatus.DepositPaid || p.Status == PaymentStatus.FullyPaid));

            if (!hasApprovedPayment)
            {
                var hasOtherQualifying = booking.Payments
                    .Any(p => p.Id != payment.Id &&
                              p.SubmittedAt <= booking.PaymentDueAt.Value &&
                              (p.Status == PaymentStatus.Pending || p.Status == PaymentStatus.DepositPaid || p.Status == PaymentStatus.FullyPaid));

                if (!hasOtherQualifying)
                {
                    bookingExpired = true;
                    prevBookingStatus = booking.Status.ToString();
                    booking.Status = BookingStatus.Cancelled;
                    booking.PaymentExpiredAt = now;
                    booking.CancellationReason = "Advance payment was rejected after the payment deadline.";
                }
            }
        }

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Payment",
                entityId: payment.Id,
                action: "PaymentRejected",
                performedBy: staffUserId,
                details: new
                {
                    bookingId = payment.BookingId,
                    amount = payment.Amount,
                    rejectionReason = reason,
                    reviewedAt = payment.ReviewedAt
                },
                ct: ct);

            if (bookingExpired && booking != null)
            {
                await _auditLogService.LogAsync(
                    entityType: "Booking",
                    entityId: booking.Id,
                    action: "BookingPaymentExpired",
                    performedBy: staffUserId,
                    details: new
                    {
                        bookingId = booking.Id,
                        travelerId = booking.TravelerId,
                        tourPackageId = booking.TourPackageId,
                        paymentDueAt = booking.PaymentDueAt,
                        expiredAt = booking.PaymentExpiredAt,
                        previousStatus = prevBookingStatus,
                        newStatus = booking.Status.ToString(),
                        reason = booking.CancellationReason
                    },
                    ct: ct);
            }

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        _logger.LogInformation("Payment {PaymentId} rejected for booking {BookingId}. Reason: {Reason}",
            payment.Id, payment.BookingId, reason);

        return RejectPaymentResult.Success(payment);
    }

    public Task<RecordPaymentResult> RecordPaymentAsync(
        Guid bookingId,
        decimal amount,
        string method,
        Guid travelerId,
        CancellationToken ct = default)
    {
        if (string.Equals(method, "Card", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(RecordPaymentResult.Failure("Card payments are no longer supported. Please submit a bank transfer slip.", 400));
        }

        return Task.FromResult(RecordPaymentResult.Failure("Direct payment recording is deprecated. Please upload a bank transfer slip to /api/bookings/{id}/payments/bank-transfer.", 400));
    }

    public async Task<PaymentStatusResult> GetPaymentStatusAsync(
        Guid bookingId,
        Guid requestingUserId,
        bool isManagerOrAdmin,
        CancellationToken ct = default)
    {
        var booking = await _db.Bookings
            .AsNoTracking()
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking is null)
        {
            return PaymentStatusResult.Failure("Booking not found.", 404);
        }

        var isOwner = booking.TravelerId == requestingUserId;
        if (!isOwner && !isManagerOrAdmin)
        {
            return PaymentStatusResult.Failure("Forbidden. You do not have access to view this booking's payment status.", 403);
        }

        var (totalCost, pricingBreakdown) = await GetAuthoritativePricingAsync(bookingId, ct);
        if (!totalCost.HasValue)
        {
            return PaymentStatusResult.Failure("Booking pricing is not available yet.", 400);
        }

        var approvedPayments = booking.Payments
            .Where(p => p.Status == PaymentStatus.DepositPaid || p.Status == PaymentStatus.FullyPaid)
            .ToList();

        var totalPaid = approvedPayments.Sum(p => p.Amount);
        var hasPending = booking.Payments.Any(p => p.Status == PaymentStatus.Pending);

        string status;
        if (totalPaid >= totalCost.Value)
        {
            status = "FullyPaid";
        }
        else if (totalPaid > 0)
        {
            status = "DepositPaid";
        }
        else if (hasPending)
        {
            status = "Pending";
        }
        else
        {
            status = "Unpaid";
        }

        var remainingAmount = Math.Max(totalCost.Value - totalPaid, 0m);
        var minimumAdvance = totalPaid == 0
            ? Math.Round(totalCost.Value * 0.50m, 2, MidpointRounding.AwayFromZero)
            : (decimal?)null;

        var latestRejectedPayment = booking.Payments
            .Where(p => p.Status == PaymentStatus.Failed)
            .OrderByDescending(p => p.ReviewedAt)
            .ThenByDescending(p => p.CreatedAt)
            .FirstOrDefault();

        var latestRejectedReason = latestRejectedPayment?.RejectionReason;
        var latestRejectedAt = latestRejectedPayment?.ReviewedAt;
        var latestRejectedPaymentId = latestRejectedPayment?.Id;

        var now = _clock.UtcNow;
        var isPaymentDeadlineExpired = false;

        if (booking.PaymentExpiredAt.HasValue ||
            (booking.Status == BookingStatus.Cancelled && booking.PaymentDueAt.HasValue && now > booking.PaymentDueAt.Value))
        {
            isPaymentDeadlineExpired = true;
        }
        else if (booking.Status == BookingStatus.Confirmed && booking.PaymentDueAt.HasValue && now > booking.PaymentDueAt.Value)
        {
            var hasQualifying = booking.Payments.Any(p =>
                p.SubmittedAt <= booking.PaymentDueAt.Value &&
                (p.Status == PaymentStatus.Pending || p.Status == PaymentStatus.DepositPaid || p.Status == PaymentStatus.FullyPaid));

            if (!hasQualifying)
            {
                isPaymentDeadlineExpired = true;
            }
        }

        var isBalancePaymentDeadlineExpired = booking.Status == BookingStatus.Completed
            && booking.BalancePaymentDueAt.HasValue
            && now >= booking.BalancePaymentDueAt.Value
            && remainingAmount > 0;

        return PaymentStatusResult.Success(
            bookingId,
            totalCost.Value,
            totalPaid,
            remainingAmount,
            status,
            hasPendingVerification: hasPending,
            minimumAdvance: minimumAdvance,
            latestRejectedPaymentReason: latestRejectedReason,
            latestRejectedAt: latestRejectedAt,
            latestRejectedPaymentId: latestRejectedPaymentId,
            paymentDueAt: booking.PaymentDueAt,
            isPaymentDeadlineExpired: isPaymentDeadlineExpired,
            balancePaymentDueAt: booking.BalancePaymentDueAt,
            isBalancePaymentDeadlineExpired: isBalancePaymentDeadlineExpired,
            bookingStatus: booking.Status.ToString(),
            pricingBreakdown: pricingBreakdown);
    }

    public async Task<Dictionary<Guid, PaymentStatusResult>> GetPaymentStatusesForBookingsAsync(
        IEnumerable<Guid> bookingIds,
        Guid requestingUserId,
        bool isManagerOrAdmin,
        CancellationToken ct = default)
    {
        var idList = bookingIds.Distinct().ToList();
        if (idList.Count == 0)
        {
            return new Dictionary<Guid, PaymentStatusResult>();
        }

        var bookings = await _db.Bookings
            .AsNoTracking()
            .Include(b => b.Payments)
            .Where(b => idList.Contains(b.Id))
            .ToListAsync(ct);

        var runs = await _db.AgentWorkflowRuns
            .AsNoTracking()
            .Where(r => idList.Contains(r.BookingId))
            .OrderByDescending(r => r.StartedAt)
            .ToListAsync(ct);

        var runIds = runs.Select(r => r.Id).Distinct().ToList();
        var stepLogs = runIds.Count > 0
            ? await _db.AgentStepLogs
                .AsNoTracking()
                .Where(s => runIds.Contains(s.WorkflowRunId) && s.AgentName == "PricingValidationAgent")
                .ToListAsync(ct)
            : new List<AgentStepLog>();

        var authoritativeCosts = new Dictionary<Guid, decimal>();
        var authoritativeBreakdowns = new Dictionary<Guid, PricingBreakdownResult>();
        foreach (var bookingId in idList)
        {
            var bookingRun = runs.FirstOrDefault(r => r.BookingId == bookingId);
            if (bookingRun != null)
            {
                var runStepLogs = stepLogs.Where(s => s.WorkflowRunId == bookingRun.Id).ToList();
                foreach (var log in runStepLogs)
                {
                    if (string.IsNullOrWhiteSpace(log.OutputJson)) continue;
                    try
                    {
                        using var doc = JsonDocument.Parse(log.OutputJson);
                        if (doc.RootElement.TryGetProperty("totalCost", out var totalCostProp) &&
                            totalCostProp.TryGetDecimal(out var totalCost))
                        {
                            authoritativeCosts[bookingId] = totalCost;
                            var bd = ParsePricingBreakdown(doc.RootElement, totalCost);
                            if (bd != null)
                            {
                                authoritativeBreakdowns[bookingId] = bd;
                            }
                            break;
                        }
                    }
                    catch (JsonException) { }
                }
            }
        }

        var results = new Dictionary<Guid, PaymentStatusResult>();
        var now = _clock.UtcNow;

        foreach (var booking in bookings)
        {
            var isOwner = booking.TravelerId == requestingUserId;
            if (!isOwner && !isManagerOrAdmin)
            {
                results[booking.Id] = PaymentStatusResult.Failure("Forbidden. You do not have access to view this booking's payment status.", 403);
                continue;
            }

            if (!authoritativeCosts.TryGetValue(booking.Id, out var totalCost))
            {
                results[booking.Id] = PaymentStatusResult.Failure("Booking pricing is not available yet.", 400);
                continue;
            }

            var approvedPayments = booking.Payments
                .Where(p => p.Status == PaymentStatus.DepositPaid || p.Status == PaymentStatus.FullyPaid)
                .ToList();

            var totalPaid = approvedPayments.Sum(p => p.Amount);
            var hasPending = booking.Payments.Any(p => p.Status == PaymentStatus.Pending);

            string status;
            if (totalPaid >= totalCost)
            {
                status = "FullyPaid";
            }
            else if (totalPaid > 0)
            {
                status = "DepositPaid";
            }
            else if (hasPending)
            {
                status = "Pending";
            }
            else
            {
                status = "Unpaid";
            }

            var remainingAmount = Math.Max(totalCost - totalPaid, 0m);
            var minimumAdvance = totalPaid == 0
                ? Math.Round(totalCost * 0.50m, 2, MidpointRounding.AwayFromZero)
                : (decimal?)null;

            var latestRejectedPayment = booking.Payments
                .Where(p => p.Status == PaymentStatus.Failed)
                .OrderByDescending(p => p.ReviewedAt)
                .ThenByDescending(p => p.CreatedAt)
                .FirstOrDefault();

            var isPaymentDeadlineExpired = false;
            if (booking.PaymentExpiredAt.HasValue ||
                (booking.Status == BookingStatus.Cancelled && booking.PaymentDueAt.HasValue && now > booking.PaymentDueAt.Value))
            {
                isPaymentDeadlineExpired = true;
            }
            else if (booking.Status == BookingStatus.Confirmed && booking.PaymentDueAt.HasValue && now > booking.PaymentDueAt.Value)
            {
                var hasQualifying = booking.Payments.Any(p =>
                    p.SubmittedAt <= booking.PaymentDueAt.Value &&
                    (p.Status == PaymentStatus.Pending || p.Status == PaymentStatus.DepositPaid || p.Status == PaymentStatus.FullyPaid));

                if (!hasQualifying)
                {
                    isPaymentDeadlineExpired = true;
                }
            }

            var isBalancePaymentDeadlineExpired = booking.Status == BookingStatus.Completed
                && booking.BalancePaymentDueAt.HasValue
                && now >= booking.BalancePaymentDueAt.Value
                && remainingAmount > 0;

            results[booking.Id] = PaymentStatusResult.Success(
                booking.Id,
                totalCost,
                totalPaid,
                remainingAmount,
                status,
                hasPendingVerification: hasPending,
                minimumAdvance: minimumAdvance,
                latestRejectedPaymentReason: latestRejectedPayment?.RejectionReason,
                latestRejectedAt: latestRejectedPayment?.ReviewedAt,
                latestRejectedPaymentId: latestRejectedPayment?.Id,
                paymentDueAt: booking.PaymentDueAt,
                isPaymentDeadlineExpired: isPaymentDeadlineExpired,
                balancePaymentDueAt: booking.BalancePaymentDueAt,
                isBalancePaymentDeadlineExpired: isBalancePaymentDeadlineExpired,
                bookingStatus: booking.Status.ToString(),
                pricingBreakdown: authoritativeBreakdowns.TryGetValue(booking.Id, out var bdResult) ? bdResult : null);
        }

        return results;
    }

    private async Task<decimal?> GetAuthoritativeTotalCostAsync(Guid bookingId, CancellationToken ct)
    {
        var (totalCost, _) = await GetAuthoritativePricingAsync(bookingId, ct);
        return totalCost;
    }

    private async Task<(decimal? TotalCost, PricingBreakdownResult? Breakdown)> GetAuthoritativePricingAsync(Guid bookingId, CancellationToken ct)
    {
        var run = await _db.AgentWorkflowRuns
            .AsNoTracking()
            .Where(r => r.BookingId == bookingId)
            .OrderByDescending(r => r.StartedAt)
            .FirstOrDefaultAsync(ct);

        if (run is null)
        {
            return (null, null);
        }

        var stepLogs = await _db.AgentStepLogs
            .AsNoTracking()
            .Where(s => s.WorkflowRunId == run.Id && s.AgentName == "PricingValidationAgent")
            .ToListAsync(ct);

        foreach (var log in stepLogs)
        {
            if (string.IsNullOrWhiteSpace(log.OutputJson)) continue;

            try
            {
                using var doc = JsonDocument.Parse(log.OutputJson);
                if (doc.RootElement.TryGetProperty("totalCost", out var totalCostProp) &&
                    totalCostProp.TryGetDecimal(out var totalCost))
                {
                    var breakdown = ParsePricingBreakdown(doc.RootElement, totalCost);
                    return (totalCost, breakdown);
                }
            }
            catch (JsonException)
            {
                // Ignore parsing errors for non-pricing logs
            }
        }

        return (null, null);
    }

    private static PricingBreakdownResult? ParsePricingBreakdown(JsonElement root, decimal fallbackTotalCost)
    {
        if (!root.TryGetProperty("breakdown", out var bdProp))
        {
            return null;
        }

        try
        {
            JsonDocument? innerDoc = null;
            JsonElement bdElement;
            if (bdProp.ValueKind == JsonValueKind.String)
            {
                var innerJson = bdProp.GetString();
                if (string.IsNullOrWhiteSpace(innerJson)) return null;
                innerDoc = JsonDocument.Parse(innerJson);
                bdElement = innerDoc.RootElement;
            }
            else if (bdProp.ValueKind == JsonValueKind.Object)
            {
                bdElement = bdProp;
            }
            else
            {
                return null;
            }

            if (bdElement.ValueKind != JsonValueKind.Object)
            {
                innerDoc?.Dispose();
                return null;
            }

            decimal baseCost = 0m;
            if (bdElement.TryGetProperty("tierBasePrice", out var tp) && tp.TryGetDecimal(out var tpVal))
                baseCost = tpVal;
            else if (bdElement.TryGetProperty("basePricePerPerson", out var bpp) && bpp.TryGetDecimal(out var bppVal)
                     && bdElement.TryGetProperty("groupSize", out var gs) && gs.TryGetInt32(out var gsVal))
                baseCost = bppVal * gsVal;

            decimal cateringCost = 0m;
            if (bdElement.TryGetProperty("cateringCost", out var cp) && cp.TryGetDecimal(out var cpVal))
                cateringCost = cpVal;
            else if (bdElement.TryGetProperty("cateringSurchargeTotal", out var cst) && cst.TryGetDecimal(out var cstVal))
                cateringCost = cstVal;

            decimal addOnsCost = 0m;
            if (bdElement.TryGetProperty("addOnsCost", out var ap) && ap.TryGetDecimal(out var apVal))
                addOnsCost = apVal;

            decimal subtotal = baseCost + cateringCost + addOnsCost;
            if (bdElement.TryGetProperty("subtotal", out var sp) && sp.TryGetDecimal(out var spVal))
                subtotal = spVal;

            decimal discountAmount = 0m;
            if (bdElement.TryGetProperty("groupDiscount", out var dp) && dp.TryGetDecimal(out var dpVal))
                discountAmount = dpVal;

            decimal finalTotal = fallbackTotalCost;
            if (bdElement.TryGetProperty("finalTotal", out var fp) && fp.TryGetDecimal(out var fpVal))
                finalTotal = fpVal;

            string? discountDescription = null;
            if (bdElement.TryGetProperty("discountDescription", out var ddp) && ddp.ValueKind == JsonValueKind.String)
                discountDescription = ddp.GetString();

            decimal? discountPercentage = null;
            if (bdElement.TryGetProperty("discountPercentage", out var dpp) && dpp.TryGetDecimal(out var dppVal))
                discountPercentage = dppVal;

            innerDoc?.Dispose();

            return new PricingBreakdownResult(
                baseCost,
                cateringCost,
                addOnsCost,
                subtotal,
                discountAmount,
                finalTotal,
                discountDescription,
                discountPercentage);
        }
        catch
        {
            return null;
        }
    }
}
