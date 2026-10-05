using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class ApprovalService : IApprovalService
{
    private readonly TrailWiseDbContext _db;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IAuditLogService _auditLogService;
    private readonly IFleetReservationService _fleetReservationService;
    private readonly IFleetCapacityAgent _fleetAgent;
    private readonly IGuideAssignmentService _guideAssignmentService;
    private readonly IGuideAvailabilityService _guideAvailabilityService;
    private readonly IGuideMatchingAgent _guideMatchingAgent;
    private readonly IBookingLifecycleService _bookingLifecycleService;
    private readonly ILogger<ApprovalService> _logger;
    private readonly CancellationOptions _cancellation;
    private readonly IClock _clock;
    private readonly IToolCallRecorder? _toolCalls;

    public ApprovalService(
        TrailWiseDbContext db,
        IServiceScopeFactory scopeFactory,
        IAuditLogService auditLogService,
        IFleetReservationService fleetReservationService,
        IFleetCapacityAgent fleetAgent,
        IGuideAssignmentService guideAssignmentService,
        IGuideAvailabilityService guideAvailabilityService,
        IGuideMatchingAgent guideMatchingAgent,
        IBookingLifecycleService bookingLifecycleService,
        ILogger<ApprovalService> logger,
        IOptions<CancellationOptions> cancellation,
        IClock clock,
        IToolCallRecorder? toolCalls = null)
    {
        _toolCalls = toolCalls;
        _db = db;
        _scopeFactory = scopeFactory;
        _auditLogService = auditLogService;
        _fleetReservationService = fleetReservationService;
        _fleetAgent = fleetAgent;
        _guideAssignmentService = guideAssignmentService;
        _guideAvailabilityService = guideAvailabilityService;
        _guideMatchingAgent = guideMatchingAgent;
        _bookingLifecycleService = bookingLifecycleService;
        _logger = logger;
        _cancellation = cancellation.Value;
        _clock = clock;
    }

    public async Task<ApprovalDecisionResult> DecideApprovalAsync(
        Guid approvalId,
        ApprovalDecision decision,
        string? note,
        Guid performedBy,
        CancellationToken ct = default)
    {
        var request = await _db.ApprovalRequests.FirstOrDefaultAsync(a => a.Id == approvalId, ct);
        if (request is null)
        {
            return ApprovalDecisionResult.NotFound();
        }

        if (request.Status != ApprovalStatus.Pending)
        {
            return ApprovalDecisionResult.Conflict($"This approval is already {request.Status} and cannot be decided again.");
        }

        var trimmedNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        if (decision is ApprovalDecision.Reject or ApprovalDecision.RequestRevision && trimmedNote is null)
        {
            return ApprovalDecisionResult.Invalid(
                decision == ApprovalDecision.Reject
                    ? "A note is required when rejecting."
                    : "A note is required when requesting a revision.");
        }

        if (request.Type == ApprovalType.RefundException)
        {
            return await DecideRefundExceptionAsync(request, decision, trimmedNote, performedBy, ct);
        }

        return await DecideBookingCoreAsync(request.BookingId, decision, trimmedNote, null, performedBy, request, ct);
    }

    private static bool IsApprovedPayment(Payment p) => p.Status is PaymentStatus.DepositPaid or PaymentStatus.FullyPaid;

    public async Task<ApprovalDecisionResult?> TryRequestRefundExceptionAsync(
        Guid bookingId,
        string? travelerReason,
        Guid requestedBy,
        CancellationToken ct = default)
    {
        var booking = await _db.Bookings
            .Include(b => b.TourPackage)
            .Include(b => b.PackageTier)
            .Include(b => b.GuideAvailabilities)
                .ThenInclude(ga => ga.Guide)
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);
        if (booking is null)
        {
            return ApprovalDecisionResult.NotFound();
        }

        var today = DateOnly.FromDateTime(_clock.UtcNow.UtcDateTime);
        var approvedPayments = booking.Payments.Where(IsApprovedPayment).ToList();
        if (!CancellationPolicy.RequiresApproval(today, booking.StartDate, _cancellation.RefundWindowDays, approvedPayments.Count > 0))
        {
            return null;
        }

        if (await _db.ApprovalRequests.AnyAsync(a => a.BookingId == bookingId && a.Status == ApprovalStatus.Pending, ct))
        {
            return ApprovalDecisionResult.Conflict("A decision on this booking is already pending with the Operations Manager.");
        }

        var daysUntilStart = CancellationPolicy.DaysUntilStart(today, booking.StartDate);
        var paidAmount = approvedPayments.Sum(p => p.Amount);
        var reasons = new List<string>
        {
            $"Cancellation requested {daysUntilStart} day(s) before the start date, inside the {_cancellation.RefundWindowDays}-day window.",
            $"Approved payments on record: {paidAmount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture)}."
        };
        var reason = string.IsNullOrWhiteSpace(travelerReason) ? null : travelerReason.Trim();

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;
        try
        {
            var request = new ApprovalRequest
            {
                BookingId = booking.Id,
                Type = ApprovalType.RefundException,
                Status = ApprovalStatus.Pending,
                PreviousBookingStatus = booking.Status,
                ReasonsJson = JsonSerializer.Serialize(reasons, AgentJsonOptions.Default),
                RequesterNote = reason,
                RequestedAt = _clock.UtcNow,
            };
            _db.ApprovalRequests.Add(request);
            booking.Status = BookingStatus.PendingApproval;
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Booking",
                entityId: booking.Id,
                action: "RefundExceptionRequested",
                performedBy: requestedBy,
                details: new
                {
                    approvalId = request.Id,
                    reason,
                    daysUntilStart,
                    windowDays = _cancellation.RefundWindowDays,
                    approvedPaymentTotal = paidAmount,
                },
                ct: ct);

            if (transaction is not null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        return new ApprovalDecisionResult(ApprovalOutcome.Success, booking);
    }

    /// <summary>
    /// Approve: the booking is cancelled and its approved payments are marked Refunded (a status
    /// change only; the money is returned by staff outside the system, there is no payment gateway).
    /// Reject: the booking is cancelled with no refund. Request revision: the booking goes back to
    /// the status it had, with the note visible to the traveler. Guide and vehicle are released
    /// when the booking is cancelled. All in one transaction with the audit log entry.
    /// </summary>
    private async Task<ApprovalDecisionResult> DecideRefundExceptionAsync(
        ApprovalRequest approval,
        ApprovalDecision decision,
        string? note,
        Guid performedBy,
        CancellationToken ct)
    {
        var booking = await _db.Bookings
            .Include(b => b.TourPackage)
            .Include(b => b.PackageTier)
            .Include(b => b.GuideAvailabilities)
                .ThenInclude(ga => ga.Guide)
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == approval.BookingId, ct);
        if (booking is null)
        {
            return ApprovalDecisionResult.NotFound();
        }

        if (booking.Status != BookingStatus.PendingApproval)
        {
            return ApprovalDecisionResult.Conflict(
                $"This booking is {booking.Status}, so its cancellation request can no longer be decided.");
        }

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;
        try
        {
            var refunded = new List<Payment>();
            switch (decision)
            {
                case ApprovalDecision.Approve:
                    foreach (var payment in booking.Payments.Where(IsApprovedPayment))
                    {
                        payment.Status = PaymentStatus.Refunded;
                        refunded.Add(payment);
                    }
                    booking.Status = BookingStatus.Cancelled;
                    booking.CancellationReason = approval.RequesterNote ?? note;
                    await ReleaseResourcesAsync(booking.Id, ct);
                    break;
                case ApprovalDecision.Reject:
                    booking.Status = BookingStatus.Cancelled;
                    booking.CancellationReason = approval.RequesterNote ?? note;
                    await ReleaseResourcesAsync(booking.Id, ct);
                    break;
                default:
                    booking.Status = approval.PreviousBookingStatus ?? BookingStatus.Confirmed;
                    booking.RevisionNote = note;
                    break;
            }

            approval.Status = decision switch
            {
                ApprovalDecision.Approve => ApprovalStatus.Approved,
                ApprovalDecision.Reject => ApprovalStatus.Rejected,
                _ => ApprovalStatus.RevisionRequested
            };
            approval.DecidedBy = performedBy;
            approval.DecidedAt = _clock.UtcNow;
            approval.DecisionNote = note;

            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Booking",
                entityId: booking.Id,
                action: decision switch
                {
                    ApprovalDecision.Approve => "RefundExceptionApproved",
                    ApprovalDecision.Reject => "RefundExceptionRejected",
                    _ => "RefundExceptionRevisionRequested"
                },
                performedBy: performedBy,
                details: new
                {
                    decision = decision.ToString(),
                    notes = note,
                    approvalId = approval.Id,
                    refundedPaymentIds = refunded.Select(p => p.Id).ToList(),
                    refundedAmount = refunded.Sum(p => p.Amount),
                },
                ct: ct);

            if (transaction is not null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        return new ApprovalDecisionResult(ApprovalOutcome.Success, booking);
    }

    public async Task<ApprovalDecisionResult> DecideBookingAsync(
        Guid bookingId,
        ApprovalDecision decision,
        string? note,
        Guid? guideId,
        Guid performedBy,
        CancellationToken ct = default)
    {
        var request = await _db.ApprovalRequests
            .FirstOrDefaultAsync(a => a.BookingId == bookingId && a.Status == ApprovalStatus.Pending, ct);

        if (request?.Type == ApprovalType.RefundException)
        {
            return ApprovalDecisionResult.Conflict("This booking has a pending refund exception; decide it from the approvals queue.");
        }

        return await DecideBookingCoreAsync(bookingId, decision, note, guideId, performedBy, request, ct);
    }

    private async Task<ApprovalDecisionResult> DecideBookingCoreAsync(
        Guid bookingId,
        ApprovalDecision decision,
        string? notes,
        Guid? requestedGuideId,
        Guid performedBy,
        ApprovalRequest? approval,
        CancellationToken ct)
    {
        var booking = await _db.Bookings
            .Include(b => b.TourPackage)
            .Include(b => b.PackageTier)
            .Include(b => b.GuideAvailabilities)
                .ThenInclude(ga => ga.Guide)
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking is null)
        {
            return ApprovalDecisionResult.NotFound();
        }

        if (!BookingStatusTransitions.CanDecide(booking.Status))
        {
            return ApprovalDecisionResult.Conflict($"This booking is already {booking.Status} and cannot be decided again.");
        }

        if (decision == ApprovalDecision.Reject)
        {
            booking.Status = BookingStatus.Cancelled;
            booking.CancellationReason = notes;
        }
        else if (decision == ApprovalDecision.RequestRevision)
        {
            booking.Status = BookingStatus.PlanProposed;
            booking.RevisionNote = notes;
        }

        var run = await _db.AgentWorkflowRuns
            .Where(r => r.BookingId == booking.Id)
            .OrderByDescending(r => r.StartedAt)
            .FirstOrDefaultAsync(ct);

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            if (decision == ApprovalDecision.Approve)
            {
                var confirmError = await AssignResourcesAndConfirmAsync(booking, run, requestedGuideId, transaction is not null, ct);
                if (confirmError is not null)
                {
                    if (transaction is not null)
                    {
                        await transaction.RollbackAsync(ct);
                    }
                    return ApprovalDecisionResult.Conflict(confirmError);
                }
            }

            if (run is not null)
            {
                // "Completed" here means the workflow run itself is finished, not that the
                // booking was approved: approve, reject and request-revision all conclude the
                // run, they just leave the booking in different statuses.
                run.Status = "Completed";
                run.CompletedAt = DateTimeOffset.UtcNow;

                _db.AgentStepLogs.Add(new AgentStepLog
                {
                    WorkflowRunId = run.Id,
                    AgentName = "manager_decision",
                    InputJson = JsonSerializer.Serialize(
                        new { decision = decision.ToString(), notes, approvalType = approval?.Type.ToString() },
                        AgentJsonOptions.Default),
                    OutputJson = JsonSerializer.Serialize(
                        new { newStatus = booking.Status.ToString() },
                        AgentJsonOptions.Default),
                    ToolCallsJson = _toolCalls?.DrainJson(),
                    DurationMs = 0,
                });
            }

            if (decision == ApprovalDecision.Reject)
            {
                await ReleaseResourcesAsync(booking.Id, ct);
            }

            if (approval is not null)
            {
                approval.Status = decision switch
                {
                    ApprovalDecision.Approve => ApprovalStatus.Approved,
                    ApprovalDecision.Reject => ApprovalStatus.Rejected,
                    _ => ApprovalStatus.RevisionRequested
                };
                approval.DecidedBy = performedBy;
                approval.DecidedAt = DateTimeOffset.UtcNow;
                approval.DecisionNote = notes;
            }

            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Booking",
                entityId: booking.Id,
                action: decision switch
                {
                    ApprovalDecision.Approve => "BookingApproved",
                    ApprovalDecision.Reject => "BookingRejected",
                    _ => "BookingRevisionRequested"
                },
                performedBy: performedBy,
                details: new
                {
                    decision = decision.ToString(),
                    notes,
                    approvalId = approval?.Id,
                    approvalType = approval?.Type.ToString()
                },
                ct: ct);

            if (transaction is not null)
            {
                await transaction.CommitAsync(ct);
            }

            if (decision == ApprovalDecision.Approve)
            {
                DispatchConfirmationNotifications(booking.Id);
            }
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        return new ApprovalDecisionResult(ApprovalOutcome.Success, booking);
    }

    private async Task ReleaseResourcesAsync(Guid bookingId, CancellationToken ct)
    {
        await _guideAssignmentService.ReleaseGuideAsync(bookingId, ct);
        var assignments = await _db.VehicleAssignments.Where(a => a.BookingId == bookingId).ToListAsync(ct);
        if (assignments.Count > 0)
        {
            _db.VehicleAssignments.RemoveRange(assignments);
        }
    }

    /// <summary>
    /// Assigns the AI-matched vehicle/driver and a guide who passes the Guide Matching rules, then
    /// confirms the booking. Returns an error message when a resource is missing (the caller rolls back).
    /// </summary>
    private async Task<string?> AssignResourcesAndConfirmAsync(
        Booking booking, AgentWorkflowRun? run, Guid? requestedGuideId, bool inTransaction, CancellationToken ct)
    {
        // The guide assignment saves on its own, so it goes first: anything added after it stays
        // unsaved until the final SaveChanges and is simply discarded if the approval fails.
        var guideAssignedNow = await AssignGuideIfMissingAsync(booking, run, requestedGuideId, ct);
        await AssignVehicleAndDriverIfMissingAsync(booking, run, ct);

        // Strictly verify all 3 resources before transitioning to Confirmed:
        var hasAssignedGuide = _db.GuideAvailabilities.Local.Any(a => a.AssignedBookingId == booking.Id && a.GuideId != Guid.Empty) ||
            await _db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == booking.Id && a.GuideId != Guid.Empty, ct);
        var hasVehicleAndDriver = _db.VehicleAssignments.Local.Any(a => a.BookingId == booking.Id && a.VehicleId != Guid.Empty && a.DriverId != Guid.Empty) ||
            await _db.VehicleAssignments.AnyAsync(a => a.BookingId == booking.Id && a.VehicleId != Guid.Empty && a.DriverId != Guid.Empty, ct);

        if (hasAssignedGuide && hasVehicleAndDriver)
        {
            _bookingLifecycleService.TransitionToConfirmed(booking);
            return null;
        }

        var missingResources = new List<string>();
        if (!hasVehicleAndDriver) missingResources.Add("Vehicle & Driver");
        if (!hasAssignedGuide) missingResources.Add("Tour Guide");

        var message = $"A booking cannot be confirmed until all resources are allocated. Missing: {string.Join(", ", missingResources)}.";
        _logger.LogWarning("Approval conflict on booking {BookingId}: {Message}. hasAssignedGuide={HasGuide}, hasVehicleAndDriver={HasVehicleAndDriver}",
            booking.Id, message, hasAssignedGuide, hasVehicleAndDriver);

        if (guideAssignedNow && !inTransaction)
        {
            // The guide assignment saves on its own. With a real database the caller's transaction
            // rolls it back; without one (in-memory provider) undo it here so a failed approval
            // never leaves a guide held. Pending, unsaved changes (run completion, vehicle row) are
            // discarded first so the cleanup save cannot persist them.
            _db.ChangeTracker.Clear();
            await _guideAssignmentService.ReleaseGuideAsync(booking.Id, ct);
            await _db.SaveChangesAsync(ct);
        }

        return message;
    }

    private Task<bool> CheckVehicleAsync(Guid vehicleId, Booking booking, CancellationToken ct) =>
        _toolCalls.TrackAsync(
            AgentTools.VehicleAvailabilityRead,
            $"vehicle {vehicleId}, {booking.StartDate:yyyy-MM-dd} to {booking.EndDate:yyyy-MM-dd}",
            () => _fleetReservationService.IsVehicleAvailableAsync(vehicleId, booking.StartDate, booking.EndDate, ct),
            ok => ok ? "available" : "not available");

    private Task<bool> CheckDriverAsync(Guid driverId, Booking booking, CancellationToken ct) =>
        _toolCalls.TrackAsync(
            AgentTools.VehicleAvailabilityRead,
            $"driver {driverId}, {booking.StartDate:yyyy-MM-dd} to {booking.EndDate:yyyy-MM-dd}",
            () => _fleetReservationService.IsDriverAvailableAsync(driverId, booking.StartDate, booking.EndDate, ct),
            ok => ok ? "available" : "not available");

    private async Task AssignVehicleAndDriverIfMissingAsync(Booking booking, AgentWorkflowRun? run, CancellationToken ct)
    {
        if (await _db.VehicleAssignments.AnyAsync(a => a.BookingId == booking.Id, ct))
        {
            return;
        }

        Guid vehicleId = Guid.Empty;
        Guid driverId = Guid.Empty;

        if (run is not null)
        {
            var vehicleStepLog = await _db.AgentStepLogs
                .Where(s => s.WorkflowRunId == run.Id && s.AgentName == "FleetCapacityAgent")
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync(ct);

            if (vehicleStepLog != null && !string.IsNullOrWhiteSpace(vehicleStepLog.OutputJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(vehicleStepLog.OutputJson);
                    if (doc.RootElement.TryGetProperty("vehicleId", out var vProp) && vProp.TryGetGuid(out var vGuid))
                        vehicleId = vGuid;
                    if (doc.RootElement.TryGetProperty("driverId", out var dProp) && dProp.TryGetGuid(out var dGuid))
                        driverId = dGuid;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse vehicleStepLog OutputJson for booking {BookingId}", booking.Id);
                }
            }
        }

        // Check if proposed vehicle and driver are still available
        bool isVehAvail = vehicleId != Guid.Empty && await CheckVehicleAsync(vehicleId, booking, ct);
        bool isDrvAvail = driverId != Guid.Empty && await CheckDriverAsync(driverId, booking, ct);

        // If neither was proposed or if either has been taken by an earlier approval, dynamically re-match against the currently available fleet
        if (!isVehAvail || !isDrvAvail)
        {
            if (vehicleId != Guid.Empty || driverId != Guid.Empty)
            {
                _logger.LogInformation("Originally proposed vehicle {VehicleId} or driver {DriverId} is no longer available for booking {BookingId}. Performing dynamic real-time re-match.",
                    vehicleId, driverId, booking.Id);
            }

            var rematch = await _fleetAgent.MatchAsync(booking.Id, ct);
            if (!rematch.ConflictCheck && rematch.VehicleId != Guid.Empty && rematch.DriverId != Guid.Empty)
            {
                vehicleId = rematch.VehicleId;
                driverId = rematch.DriverId;
                isVehAvail = await CheckVehicleAsync(vehicleId, booking, ct);
                isDrvAvail = await CheckDriverAsync(driverId, booking, ct);
            }
        }

        if (isVehAvail && isDrvAvail)
        {
            // The vehicle write is gated behind approval (design doc 8.4): this is the approved write.
            _toolCalls.RecordCall(
                AgentTools.VehicleAvailabilityWrite,
                $"reserve vehicle {vehicleId} with driver {driverId}, {booking.StartDate:yyyy-MM-dd} to {booking.EndDate:yyyy-MM-dd}",
                "reserved after the Operations Manager's approval",
                0);
            _db.VehicleAssignments.Add(new VehicleAssignment
            {
                VehicleId = vehicleId,
                DriverId = driverId,
                BookingId = booking.Id,
                StartDate = booking.StartDate,
                EndDate = booking.EndDate
            });
            _logger.LogInformation("Auto-assigned vehicle {VehicleId} and driver {DriverId} to approved booking {BookingId}",
                vehicleId, driverId, booking.Id);
        }
        else
        {
            _logger.LogWarning("No suitable available vehicle or driver could be assigned to booking {BookingId} upon approval",
                booking.Id);
        }
    }

    /// <returns>True when this call assigned a guide (false when one was already assigned or none qualified).</returns>
    private async Task<bool> AssignGuideIfMissingAsync(Booking booking, AgentWorkflowRun? run, Guid? requestedGuideId, CancellationToken ct)
    {
        if (await _db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == booking.Id, ct))
        {
            return false;
        }

        Guid guideId = requestedGuideId ?? Guid.Empty;

        if (guideId == Guid.Empty && run is not null)
        {
            var guideStepLog = await _db.AgentStepLogs
                .Where(s => s.WorkflowRunId == run.Id && s.AgentName == "GuideMatchingAgent")
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync(ct);

            if (guideStepLog != null && !string.IsNullOrWhiteSpace(guideStepLog.OutputJson))
            {
                try
                {
                    using var gDoc = JsonDocument.Parse(guideStepLog.OutputJson);
                    if (gDoc.RootElement.TryGetProperty("guideId", out var gProp) && gProp.TryGetGuid(out var gGuid))
                        guideId = gGuid;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse guideStepLog OutputJson for booking {BookingId}", booking.Id);
                }
            }
        }

        // Only auto-assign a guide who passes the Guide Matching rules (specialization, language,
        // availability): design doc 8.4 requires these deterministic checks before approval. A
        // proposed guide (manager-supplied or from the workflow run) that no longer qualifies is
        // dropped and the matcher is asked again.
        bool isGuideAvail = guideId != Guid.Empty
            && await _guideMatchingAgent.IsQualifiedAsync(booking.Id, guideId, ct);

        if (!isGuideAvail)
        {
            var rematchGuide = await _guideMatchingAgent.MatchAsync(booking.Id, ct);
            guideId = rematchGuide.GuideId;
            isGuideAvail = guideId != Guid.Empty
                && await _guideAvailabilityService.IsGuideAvailableAsync(guideId, booking.StartDate, booking.EndDate, ct);
        }

        if (isGuideAvail && guideId != Guid.Empty)
        {
            var assigned = await _guideAssignmentService.AssignGuideAsync(booking.Id, guideId, ct);
            _logger.LogInformation("Auto-assigned tour guide {GuideId} to approved booking {BookingId}", guideId, booking.Id);
            return assigned;
        }

        _logger.LogWarning("No guide passing the matching rules could be auto-assigned to booking {BookingId} upon approval", booking.Id);
        return false;
    }

    private void DispatchConfirmationNotifications(Guid bookingId)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var notificationService = scope.ServiceProvider.GetRequiredService<IBookingNotificationService>();
                await notificationService.SendBookingConfirmedNotificationsAsync(bookingId, CancellationToken.None);
            }
            catch (Exception notifEx)
            {
                _logger.LogError(notifEx, "Failed to dispatch confirmation SMS notifications for Booking {BookingId}", bookingId);
            }
        });
    }
}
