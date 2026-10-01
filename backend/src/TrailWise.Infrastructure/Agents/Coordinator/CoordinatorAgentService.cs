using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Infrastructure.Agents;

internal static class WorkflowRunStatus
{
    public const string Running = "Running";
    public const string AwaitingApproval = "AwaitingApproval";
    public const string Completed = "Completed";
    public const string Failed = "Failed";
}

/// <summary>
/// Reads a newly created booking, builds a step-by-step plan, and delegates to the Guide
/// Matching, Fleet &amp; Capacity, and Pricing &amp; Validation agents (mocked until those
/// teammates' real implementations exist — see the Mock*Agent classes in this folder).
/// Deterministic business rules (BookingApprovalEvaluator) — not any agent's "judgement" —
/// decide the final outcome, per the design doc's Section 8.4 requirement.
/// </summary>
public class CoordinatorAgentService : ICoordinatorAgentService
{
    private readonly TrailWiseDbContext _db;
    private readonly IPreferenceExtractionAgent _preferenceAgent;
    private readonly IGuideMatchingAgent _guideAgent;
    private readonly IFleetCapacityAgent _fleetAgent;
    private readonly IPricingValidationAgent _pricingAgent;
    private readonly IGuideAssignmentService _guideAssignmentService;
    private readonly IFleetReservationService? _fleetReservationService;
    private readonly IProposalSummaryAgent _summaryAgent;
    private readonly ILogger<CoordinatorAgentService> _logger;
    private readonly IBookingLifecycleService _bookingLifecycleService;
    private readonly IClock _clock;
    private readonly IServiceScopeFactory? _scopeFactory;

    public CoordinatorAgentService(
        TrailWiseDbContext db,
        IPreferenceExtractionAgent preferenceAgent,
        IGuideMatchingAgent guideAgent,
        IFleetCapacityAgent fleetAgent,
        IPricingValidationAgent pricingAgent,
        IGuideAssignmentService guideAssignmentService,
        IProposalSummaryAgent summaryAgent,
        ILogger<CoordinatorAgentService> logger,
        IBookingLifecycleService? bookingLifecycleService = null,
        IClock? clock = null,
        IFleetReservationService? fleetReservationService = null,
        IServiceScopeFactory? scopeFactory = null)
    {
        _db = db;
        _preferenceAgent = preferenceAgent;
        _guideAgent = guideAgent;
        _fleetAgent = fleetAgent;
        _pricingAgent = pricingAgent;
        _guideAssignmentService = guideAssignmentService;
        _summaryAgent = summaryAgent;
        _logger = logger;
        _fleetReservationService = fleetReservationService;
        _clock = clock ?? new SystemClock();
        _bookingLifecycleService = bookingLifecycleService ?? new BookingLifecycleService(_clock);
        _scopeFactory = scopeFactory;
    }

    public async Task StartWorkflowAsync(Guid bookingId, CancellationToken ct = default)
    {
        var booking = await _db.Bookings
            .Include(b => b.PackageTier)
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking is null)
        {
            _logger.LogWarning("StartWorkflowAsync called for a booking that no longer exists: {BookingId}", bookingId);
            return;
        }

        var plan = new AgentWorkflowPlan
        {
            Steps =
            {
                new AgentWorkflowPlanStep { Step = "extract_preferences", Agent = "PreferenceExtractionAgent" },
                new AgentWorkflowPlanStep { Step = "match_guide", Agent = "GuideMatchingAgent" },
                new AgentWorkflowPlanStep { Step = "check_vehicle", Agent = "FleetCapacityAgent" },
                new AgentWorkflowPlanStep { Step = "calculate_price", Agent = "PricingValidationAgent" },
                new AgentWorkflowPlanStep { Step = "validate", Agent = "PricingValidationAgent" },
                new AgentWorkflowPlanStep { Step = "summarize", Agent = "ProposalSummaryAgent" },
            },
        };

        var run = new AgentWorkflowRun
        {
            BookingId = bookingId,
            // SECURITY (E5): booking.SpecialRequests is untrusted free text supplied by the
            // traveler. It must NEVER be interpolated into Objective (this run-level description,
            // shared by every step) or into any OTHER step's InputJson/LLM context — e.g. the
            // future Proposal Summary agent must never see it directly. It is legitimately read
            // ONLY by PreferenceExtractionAgent below, and only ever placed inside an explicitly
            // labeled <untrusted_traveler_note> block that instructs the model never to treat it
            // as instructions. That step's own InputJson intentionally records the raw text, since
            // documenting exactly what was sent to the LLM is the point of this step's audit trail.
            Objective = "Match a guide, verify vehicle capacity, price the trip, and validate against business rules.",
            PlanJson = Serialize(plan),
            Status = WorkflowRunStatus.Running,
            StartedAt = DateTimeOffset.UtcNow,
        };
        _db.AgentWorkflowRuns.Add(run);
        await _db.SaveChangesAsync(ct);

        var preferencesResult = await RunStepAsync(
            run,
            plan,
            "extract_preferences",
            "PreferenceExtractionAgent",
            new { specialRequests = booking.SpecialRequests },
            () => _preferenceAgent.ExtractAsync(booking.SpecialRequests, ct),
            ct);

        var guideResult = await RunStepAsync(
            run,
            plan,
            "match_guide",
            "GuideMatchingAgent",
            new { bookingId },
            () => _guideAgent.MatchAsync(bookingId, ct),
            ct);

        var vehicleResult = await RunStepAsync(
            run,
            plan,
            "check_vehicle",
            "FleetCapacityAgent",
            new { bookingId },
            () => _fleetAgent.MatchAsync(bookingId, ct),
            ct);

        var pricingResult = await RunStepAsync(
            run,
            plan,
            "calculate_price",
            "PricingValidationAgent",
            new { bookingId, guideResult, vehicleResult },
            () => _pricingAgent.CalculateAsync(bookingId, guideResult, vehicleResult, ct),
            ct);

        var evaluatorInput = new BookingApprovalEvaluator.Input(
            GroupSize: booking.GroupSize,
            BudgetPerPerson: booking.BudgetPerPerson,
            TotalCost: pricingResult.TotalCost,
            TierRequiresAc: booking.PackageTier.RequiresAC,
            VehicleAcMatch: vehicleResult.AcMatch,
            VehicleConflictCheck: vehicleResult.ConflictCheck,
            GuideMatchScore: guideResult.MatchScore);

        var sw = Stopwatch.StartNew();
        var decisionResult = BookingApprovalEvaluator.Evaluate(evaluatorInput);
        sw.Stop();

        var validateStepLog = new AgentStepLog
        {
            WorkflowRunId = run.Id,
            AgentName = "PricingValidationAgent",
            InputJson = Serialize(evaluatorInput),
            OutputJson = Serialize(new { decision = decisionResult.Decision.ToString(), reasons = decisionResult.Reasons }),
            ValidationResult = decisionResult.Decision.ToString(),
            DurationMs = sw.ElapsedMilliseconds,
        };
        MarkStepDone(plan, "validate");
        run.PlanJson = Serialize(plan);

        var assignmentSucceeded = false;
        switch (decisionResult.Decision)
        {
            case BookingApprovalEvaluator.Decision.Approved:
                assignmentSucceeded = false;
                if (guideResult.GuideId != Guid.Empty)
                {
                    assignmentSucceeded = await _guideAssignmentService.AssignGuideAsync(bookingId, guideResult.GuideId, ct);
                }

                if (_fleetReservationService != null && vehicleResult.VehicleId != Guid.Empty && vehicleResult.DriverId != Guid.Empty)
                {
                    var isVehAvail = await _fleetReservationService.IsVehicleAvailableAsync(vehicleResult.VehicleId, booking.StartDate, booking.EndDate, ct);
                    var isDrvAvail = await _fleetReservationService.IsDriverAvailableAsync(vehicleResult.DriverId, booking.StartDate, booking.EndDate, ct);
                    if (isVehAvail && isDrvAvail)
                    {
                        var hasAssignment = await _db.VehicleAssignments.AnyAsync(a => a.BookingId == bookingId, ct);
                        if (!hasAssignment)
                        {
                            _db.VehicleAssignments.Add(new VehicleAssignment
                            {
                                VehicleId = vehicleResult.VehicleId,
                                DriverId = vehicleResult.DriverId,
                                BookingId = bookingId,
                                StartDate = booking.StartDate,
                                EndDate = booking.EndDate
                            });
                        }
                    }
                }

                if (assignmentSucceeded)
                {
                    _bookingLifecycleService.TransitionToConfirmed(booking);
                    run.Status = WorkflowRunStatus.Completed;
                    run.CompletedAt = _clock.UtcNow;
                }
                else
                {
                    _logger.LogWarning("Guide assignment failed for approved booking {BookingId} with guide {GuideId}. Marking booking for manual review.",
                        bookingId, guideResult.GuideId);
                    booking.Status = BookingStatus.NeedsManualReview;
                    run.Status = WorkflowRunStatus.Failed;
                    run.CompletedAt = _clock.UtcNow;
                }
                break;
            case BookingApprovalEvaluator.Decision.NeedsApproval:
                booking.Status = BookingStatus.PendingApproval;
                run.Status = WorkflowRunStatus.AwaitingApproval;
                // CompletedAt intentionally left null: this run is paused pending a future
                // (out-of-scope) human-approval step, not finished.
                break;
            case BookingApprovalEvaluator.Decision.ValidationFailed:
                booking.Status = BookingStatus.NeedsManualReview;
                run.Status = WorkflowRunStatus.Failed;
                run.CompletedAt = _clock.UtcNow;
                break;
        }

        _db.AgentStepLogs.Add(validateStepLog);

        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational ? await _db.Database.BeginTransactionAsync(ct) : null;
        try
        {
            await _db.SaveChangesAsync(ct);
            if (transaction is not null)
            {
                await transaction.CommitAsync(ct);
            }

            if (assignmentSucceeded && _scopeFactory is not null)
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
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }

        // Best-effort, non-blocking: the booking's real outcome is already durably committed
        // above. Any failure here (disabled/unreachable LLM, malformed response) must never be
        // able to fail an already-successful workflow run — it only means SummaryText stays null.
        try
        {
            var summaryInput = new ProposalSummaryInput(
                bookingId,
                booking.GroupSize,
                booking.StartDate,
                booking.EndDate,
                booking.BudgetPerPerson,
                booking.PackageTier.ClassType.ToString(),
                booking.PackageTier.RequiresAC,
                guideResult,
                vehicleResult,
                pricingResult,
                decisionResult.Decision,
                decisionResult.Reasons,
                preferencesResult);

            var summarySw = Stopwatch.StartNew();
            var summary = await _summaryAgent.SummarizeAsync(summaryInput, ct);
            summarySw.Stop();

            run.SummaryText = summary.SummaryText;
            _db.AgentStepLogs.Add(new AgentStepLog
            {
                WorkflowRunId = run.Id,
                AgentName = "ProposalSummaryAgent",
                InputJson = Serialize(summaryInput),
                OutputJson = Serialize(summary),
                DurationMs = summarySw.ElapsedMilliseconds,
            });
            MarkStepDone(plan, "summarize");
            run.PlanJson = Serialize(plan);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Proposal summary generation failed for booking {BookingId}; leaving SummaryText null.", bookingId);
        }
    }

    private async Task<TResult> RunStepAsync<TResult>(
        AgentWorkflowRun run,
        AgentWorkflowPlan plan,
        string stepName,
        string agentName,
        object input,
        Func<Task<TResult>> call,
        CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var result = await call();
        sw.Stop();

        _db.AgentStepLogs.Add(new AgentStepLog
        {
            WorkflowRunId = run.Id,
            AgentName = agentName,
            InputJson = Serialize(input),
            OutputJson = Serialize(result),
            DurationMs = sw.ElapsedMilliseconds,
        });

        MarkStepDone(plan, stepName);
        run.PlanJson = Serialize(plan);
        await _db.SaveChangesAsync(ct);

        return result;
    }

    private static void MarkStepDone(AgentWorkflowPlan plan, string stepName)
    {
        var step = plan.Steps.FirstOrDefault(s => s.Step == stepName);
        if (step is not null)
        {
            step.Status = PlanStepStatus.Done;
        }
    }

    private static string Serialize<T>(T value) => JsonSerializer.Serialize(value, AgentJsonOptions.Default);
}
