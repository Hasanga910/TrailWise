using TrailWise.Domain.Enums;

namespace TrailWise.Domain.Entities;

/// <summary>
/// A pending (or decided) human approval for a booking. Added beyond the design document's
/// section 4 table list because /api/approvals/{id} and a pending refund request need persisted
/// state that Booking.Status alone cannot represent (see ADR 0003).
/// </summary>
public class ApprovalRequest : BaseEntity
{
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;

    public ApprovalType Type { get; set; }
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;

    /// <summary>Booking status before the request paused it (restored by some decisions).</summary>
    public BookingStatus? PreviousBookingStatus { get; set; }

    /// <summary>Why the deterministic rules required approval (JSON array of strings).</summary>
    public string? ReasonsJson { get; set; }

    /// <summary>What the requester wrote (the traveler's cancellation reason for a refund exception).</summary>
    public string? RequesterNote { get; set; }

    public DateTimeOffset RequestedAt { get; set; } = DateTimeOffset.UtcNow;

    public Guid? DecidedBy { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
    public string? DecisionNote { get; set; }
}
