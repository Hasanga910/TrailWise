namespace TrailWise.Infrastructure.Services;

/// <summary>
/// Service responsible for transactional guide reservation and assignment to bookings,
/// with conflict detection and double-booking protection (Person 2 Phase E2).
/// </summary>
public interface IGuideAssignmentService
{
    Task<bool> AssignGuideAsync(
        Guid bookingId,
        Guid guideId,
        CancellationToken ct = default);

    /// <summary>
    /// Releases every guide-availability row held by the booking (used when a booking is cancelled)
    /// so the guide can be matched to other bookings again. Does not call SaveChanges: the caller
    /// owns the transaction, so the release commits or rolls back together with the cancellation.
    /// </summary>
    /// <returns>The number of released day rows.</returns>
    Task<int> ReleaseGuideAsync(Guid bookingId, CancellationToken ct = default);
}
