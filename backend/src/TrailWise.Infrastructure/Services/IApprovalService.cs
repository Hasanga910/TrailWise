using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Infrastructure.Services;

public enum ApprovalOutcome
{
    Success,
    NotFound,
    Conflict,
    Invalid
}

public record ApprovalDecisionResult(ApprovalOutcome Outcome, Booking? Booking = null, string? Error = null)
{
    public static ApprovalDecisionResult NotFound() => new(ApprovalOutcome.NotFound);
    public static ApprovalDecisionResult Conflict(string error) => new(ApprovalOutcome.Conflict, null, error);
    public static ApprovalDecisionResult Invalid(string error) => new(ApprovalOutcome.Invalid, null, error);
}

/// <summary>
/// The Operations Manager's decision on a booking that is waiting for human approval (design doc
/// 8.2 steps 7-8, 8.3). Approving confirms the booking in a single transaction together with the
/// guide assignment, vehicle reservation and audit log entry (doc section 4).
/// </summary>
public interface IApprovalService
{
    /// <summary>Decides by approval id (the /api/approvals/{id}/decide path).</summary>
    Task<ApprovalDecisionResult> DecideApprovalAsync(
        Guid approvalId,
        ApprovalDecision decision,
        string? note,
        Guid performedBy,
        CancellationToken ct = default);

    /// <summary>
    /// Decides by booking id (the long-standing /api/bookings/{id}/decide path). Also settles the
    /// booking's open approval request, if it has one.
    /// </summary>
    Task<ApprovalDecisionResult> DecideBookingAsync(
        Guid bookingId,
        ApprovalDecision decision,
        string? note,
        Guid? guideId,
        Guid performedBy,
        CancellationToken ct = default);
}
