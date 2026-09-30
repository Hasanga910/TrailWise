using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class BookingPaymentExpiryService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IClock _clock;
    private readonly ILogger<BookingPaymentExpiryService> _logger;
    private readonly TimeSpan _period;

    public BookingPaymentExpiryService(
        IServiceScopeFactory scopeFactory,
        IClock clock,
        ILogger<BookingPaymentExpiryService> logger,
        TimeSpan? period = null)
    {
        _scopeFactory = scopeFactory;
        _clock = clock;
        _logger = logger;
        _period = period ?? TimeSpan.FromMinutes(1);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("BookingPaymentExpiryService started with scan period {Period}.", _period);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessExpiredBookingsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error in BookingPaymentExpiryService loop.");
            }

            try
            {
                await Task.Delay(_period, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("BookingPaymentExpiryService stopping.");
    }

    public async Task<int> ProcessExpiredBookingsAsync(CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var auditLogService = scope.ServiceProvider.GetRequiredService<IAuditLogService>();

        var now = _clock.UtcNow;

        // Query confirmed bookings with an expired payment deadline
        var candidates = await db.Bookings
            .Include(b => b.Payments)
            .Where(b => b.Status == BookingStatus.Confirmed
                        && b.PaymentDueAt != null
                        && b.PaymentDueAt <= now)
            .ToListAsync(ct);

        if (candidates.Count == 0)
        {
            return 0;
        }

        var expiredCount = 0;

        foreach (var booking in candidates)
        {
            // Verify if a qualifying payment was submitted before or at PaymentDueAt
            var hasQualifyingPayment = booking.Payments.Any(p =>
                (p.Status == PaymentStatus.Pending
                 || p.Status == PaymentStatus.DepositPaid
                 || p.Status == PaymentStatus.FullyPaid)
                && p.SubmittedAt <= booking.PaymentDueAt!.Value);

            if (hasQualifyingPayment)
            {
                // Protected from expiry
                continue;
            }

            var previousStatus = booking.Status.ToString();
            booking.Status = BookingStatus.Cancelled;
            booking.PaymentExpiredAt = now;
            booking.CancellationReason = "Advance payment was not submitted within the required 1-hour period.";

            await using var transaction = db.Database.IsRelational()
                ? await db.Database.BeginTransactionAsync(ct)
                : null;

            try
            {
                await db.SaveChangesAsync(ct);

                await auditLogService.LogAsync(
                    entityType: "Booking",
                    entityId: booking.Id,
                    action: "BookingPaymentExpired",
                    performedBy: null,
                    details: new
                    {
                        bookingId = booking.Id,
                        travelerId = booking.TravelerId,
                        tourPackageId = booking.TourPackageId,
                        paymentDueAt = booking.PaymentDueAt,
                        expiredAt = booking.PaymentExpiredAt,
                        previousStatus = previousStatus,
                        newStatus = "Cancelled",
                        reason = booking.CancellationReason
                    },
                    ct: ct);

                if (transaction != null)
                {
                    await transaction.CommitAsync(ct);
                }

                expiredCount++;
                _logger.LogInformation("Booking {BookingId} cancelled due to payment deadline expiry.", booking.Id);
            }
            catch (Exception ex)
            {
                if (transaction != null)
                {
                    await transaction.RollbackAsync(ct);
                }
                _logger.LogError(ex, "Failed to cancel expired booking {BookingId}.", booking.Id);
            }
        }

        return expiredCount;
    }
}
