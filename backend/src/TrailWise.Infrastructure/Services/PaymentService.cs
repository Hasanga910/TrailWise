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
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(TrailWiseDbContext db, ILogger<PaymentService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<RecordPaymentResult> RecordPaymentAsync(
        Guid bookingId,
        decimal amount,
        string method,
        Guid travelerId,
        CancellationToken ct = default)
    {
        var booking = await _db.Bookings
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking is null)
        {
            return RecordPaymentResult.Failure("Booking not found.", 404);
        }

        if (booking.TravelerId != travelerId)
        {
            return RecordPaymentResult.Failure("Forbidden. You may only pay for your own booking.", 403);
        }

        if (booking.Status != BookingStatus.Confirmed)
        {
            return RecordPaymentResult.Failure("Payment can only be recorded for confirmed bookings.", 400);
        }

        if (amount <= 0)
        {
            return RecordPaymentResult.Failure("Payment amount must be greater than 0.", 400);
        }

        if (!string.Equals(method, "Card", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(method, "BankTransfer", StringComparison.OrdinalIgnoreCase))
        {
            return RecordPaymentResult.Failure("Payment method must be 'Card' or 'BankTransfer'.", 400);
        }

        var normalizedMethod = string.Equals(method, "BankTransfer", StringComparison.OrdinalIgnoreCase)
            ? "BankTransfer"
            : "Card";

        var totalCost = await GetAuthoritativeTotalCostAsync(bookingId, ct);
        if (!totalCost.HasValue)
        {
            return RecordPaymentResult.Failure("Booking pricing is not available yet.", 400);
        }

        var previousTotalPaid = booking.Payments
            .Where(p => p.Status != PaymentStatus.Refunded)
            .Sum(p => p.Amount);

        if (previousTotalPaid >= totalCost.Value)
        {
            return RecordPaymentResult.Failure("Booking is already fully paid.", 409);
        }

        var newTotalPaid = previousTotalPaid + amount;
        var paymentStatus = newTotalPaid >= totalCost.Value
            ? PaymentStatus.FullyPaid
            : PaymentStatus.DepositPaid;

        var payment = new Payment
        {
            BookingId = bookingId,
            Amount = amount,
            Method = normalizedMethod,
            PaidAt = DateTimeOffset.UtcNow,
            Status = paymentStatus
        };

        _db.Payments.Add(payment);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Payment of {Amount} recorded for booking {BookingId}. New cumulative status: {Status}",
            amount, bookingId, paymentStatus);

        return RecordPaymentResult.Success(payment);
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

        var totalCost = await GetAuthoritativeTotalCostAsync(bookingId, ct);
        if (!totalCost.HasValue)
        {
            return PaymentStatusResult.Failure("Booking pricing is not available yet.", 400);
        }

        var validPayments = booking.Payments
            .Where(p => p.Status != PaymentStatus.Refunded)
            .ToList();

        var totalPaid = validPayments.Sum(p => p.Amount);

        string status;
        if (validPayments.Count == 0 || totalPaid == 0)
        {
            status = "Pending";
        }
        else if (totalPaid >= totalCost.Value)
        {
            status = "FullyPaid";
        }
        else
        {
            status = "DepositPaid";
        }

        var remainingAmount = Math.Max(totalCost.Value - totalPaid, 0m);

        return PaymentStatusResult.Success(bookingId, totalCost.Value, totalPaid, remainingAmount, status);
    }

    private async Task<decimal?> GetAuthoritativeTotalCostAsync(Guid bookingId, CancellationToken ct)
    {
        var run = await _db.AgentWorkflowRuns
            .AsNoTracking()
            .Where(r => r.BookingId == bookingId)
            .OrderByDescending(r => r.StartedAt)
            .FirstOrDefaultAsync(ct);

        if (run is null)
        {
            return null;
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
                    return totalCost;
                }
            }
            catch (JsonException)
            {
                // Ignore parsing errors for non-pricing logs
            }
        }

        return null;
    }
}
