using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

/// <summary>
/// Reusable transactional service for assigning a guide to a booking across its full date range,
/// with conflict detection, idempotency, and double-booking protection (Person 2 Phase E2).
/// </summary>
public class GuideAssignmentService : IGuideAssignmentService
{
    private readonly TrailWiseDbContext _db;
    private readonly ILogger<GuideAssignmentService> _logger;

    public GuideAssignmentService(TrailWiseDbContext db, ILogger<GuideAssignmentService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<bool> AssignGuideAsync(
        Guid bookingId,
        Guid guideId,
        CancellationToken ct = default)
    {
        // TASK 2: Validate Booking and Guide
        var booking = await _db.Bookings
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking is null)
        {
            _logger.LogWarning("AssignGuideAsync failed: Booking {BookingId} not found.", bookingId);
            return false;
        }

        if (booking.StartDate > booking.EndDate)
        {
            _logger.LogWarning(
                "AssignGuideAsync failed for Booking {BookingId}: StartDate {StartDate} is after EndDate {EndDate}.",
                bookingId, booking.StartDate, booking.EndDate);
            return false;
        }

        var guideExists = await _db.Guides
            .AnyAsync(g => g.Id == guideId, ct);

        if (!guideExists)
        {
            _logger.LogWarning("AssignGuideAsync failed: Guide {GuideId} not found.", guideId);
            return false;
        }

        // TASK 3: Relational Transaction
        // Use Serializable isolation and guide-level row locking when running against a relational
        // store (PostgreSQL) to prevent concurrent update anomalies and last-write-wins on existing availability rows.
        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct)
            : null;

        try
        {
            if (_db.Database.IsRelational())
            {
                await _db.Database.ExecuteSqlInterpolatedAsync(
                    $"SELECT 1 FROM \"Guides\" WHERE \"Id\" = {guideId} FOR UPDATE;", ct);
            }

            // TASK 4: Conflict Detection
            var existingAvailabilities = await _db.GuideAvailabilities
                .Where(a => a.GuideId == guideId && a.Date >= booking.StartDate && a.Date <= booking.EndDate)
                .ToListAsync(ct);

            // A row is conflicting if it is assigned to another booking or marked unavailable for another reason.
            // If the row was already assigned to this booking (idempotent call), it is not a conflict.
            var hasConflict = existingAvailabilities.Any(a =>
                (a.AssignedBookingId != null && a.AssignedBookingId != bookingId) ||
                (!a.IsAvailable && a.AssignedBookingId != bookingId));

            if (hasConflict)
            {
                _logger.LogWarning(
                    "AssignGuideAsync conflict: Guide {GuideId} has an existing assignment or manual unavailability during {StartDate} to {EndDate} for Booking {BookingId}.",
                    guideId, booking.StartDate, booking.EndDate, bookingId);

                if (transaction is not null)
                {
                    await transaction.RollbackAsync(ct);
                }
                return false;
            }

            // TASK 5: Upsert Assignment Rows for every date in [booking.StartDate, booking.EndDate]
            var existingByDate = existingAvailabilities.ToDictionary(a => a.Date);
            var daysCount = booking.EndDate.DayNumber - booking.StartDate.DayNumber;

            for (var i = 0; i <= daysCount; i++)
            {
                var date = booking.StartDate.AddDays(i);

                if (existingByDate.TryGetValue(date, out var existingRow))
                {
                    // Existing compatible row: update to assign this booking and mark unavailable
                    existingRow.AssignedBookingId = bookingId;
                    existingRow.IsAvailable = false;
                    existingRow.UpdatedAt = DateTimeOffset.UtcNow;
                }
                else
                {
                    // Create new row
                    var newRow = new GuideAvailability
                    {
                        GuideId = guideId,
                        Date = date,
                        AssignedBookingId = bookingId,
                        IsAvailable = false,
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };
                    _db.GuideAvailabilities.Add(newRow);
                }
            }

            await _db.SaveChangesAsync(ct);

            if (transaction is not null)
            {
                await transaction.CommitAsync(ct);
            }

            _logger.LogInformation(
                "Guide {GuideId} successfully assigned to Booking {BookingId} from {StartDate} to {EndDate}.",
                guideId, bookingId, booking.StartDate, booking.EndDate);

            return true;
        }
        catch (DbUpdateException ex)
        {
            // TASK 6: Concurrency / Double Booking Protection
            if (transaction is not null)
            {
                await transaction.RollbackAsync(ct);
            }
            _logger.LogWarning(ex,
                "DbUpdateException assigning Guide {GuideId} to Booking {BookingId} (concurrency/double-booking collision).",
                guideId, bookingId);
            return false;
        }
        catch (Exception ex)
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(ct);
            }
            _logger.LogError(ex, "Unexpected error assigning Guide {GuideId} to Booking {BookingId}.", guideId, bookingId);
            return false;
        }
    }
}
