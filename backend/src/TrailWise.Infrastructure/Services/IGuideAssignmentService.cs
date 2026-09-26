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
}
