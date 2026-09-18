using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

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
    private readonly IGuideMatchingAgent _guideAgent;
    private readonly IFleetCapacityAgent _fleetAgent;
    private readonly IPricingValidationAgent _pricingAgent;
    private readonly ILogger<CoordinatorAgentService> _logger;

    public CoordinatorAgentService(
        TrailWiseDbContext db,
        IGuideMatchingAgent guideAgent,
        IFleetCapacityAgent fleetAgent,
        IPricingValidationAgent pricingAgent,
        ILogger<CoordinatorAgentService> logger)
    {
        _db = db;
        _guideAgent = guideAgent;
        _fleetAgent = fleetAgent;
        _pricingAgent = pricingAgent;
        _logger = logger;
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
                new AgentWorkflowPlanStep { Step = "match_guide", Agent = "GuideMatchingAgent" },
                new AgentWorkflowPlanStep { Step = "check_vehicle", Agent = "FleetCapacityAgent" },
                new AgentWorkflowPlanStep { Step = "calculate_price", Agent = "PricingValidationAgent" },
                new AgentWorkflowPlanStep { Step = "validate", Agent = "PricingValidationAgent" },
            },
        };

        var run = new AgentWorkflowRun
        {
            BookingId = bookingId,
            // SECURITY (E5): booking.SpecialRequests is untrusted free text supplied by the
            // traveler. It must NEVER be interpolated into Objective, InputJson, or any other
            // field that could later be fed to an LLM prompt/instruction context. It is
            // intentionally not referenced anywhere in this service — only structured, typed
            // booking fields are used below.
            Objective = "Match a guide, verify vehicle capacity, price the trip, and validate against business rules.",
            PlanJson = Serialize(plan),
            Status = WorkflowRunStatus.Running,
            StartedAt = DateTimeOffset.UtcNow,
        };
        _db.AgentWorkflowRuns.Add(run);
        await _db.SaveChangesAsync(ct);

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

        switch (decisionResult.Decision)
        {
            case BookingApprovalEvaluator.Decision.Approved:
                booking.Status = BookingStatus.Confirmed;
                run.Status = WorkflowRunStatus.Completed;
                run.CompletedAt = DateTimeOffset.UtcNow;
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
                run.CompletedAt = DateTimeOffset.UtcNow;
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
