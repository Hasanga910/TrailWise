using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.AgentWorkflows;
using TrailWise.Api.Contracts.Common;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Services;

/// <summary>Read side of the agent workflow monitor: runs, plan, steps and the execution summary.</summary>
public class AgentWorkflowQueryService
{
    public static readonly string[] KnownStatuses = { "Started", "Running", "AwaitingApproval", "Completed", "Failed" };

    private readonly TrailWiseDbContext _db;

    public AgentWorkflowQueryService(TrailWiseDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<AgentWorkflowRunListItemDto>> ListAsync(
        string? status, Guid? bookingId, int page, int pageSize, CancellationToken ct)
    {
        var query = _db.AgentWorkflowRuns.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
        {
            var canonical = KnownStatuses.First(s => string.Equals(s, status, StringComparison.OrdinalIgnoreCase));
            query = query.Where(r => r.Status == canonical);
        }

        if (bookingId is not null)
        {
            query = query.Where(r => r.BookingId == bookingId);
        }

        var total = await query.CountAsync(ct);
        var rows = await query
            .OrderByDescending(r => r.StartedAt).ThenByDescending(r => r.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                r.Id,
                r.BookingId,
                BookingStatus = r.Booking.Status,
                PackageName = r.Booking.TourPackage.Name,
                TravelerName = r.Booking.Traveler.Name,
                r.Objective,
                r.Status,
                r.StartedAt,
                r.CompletedAt,
                r.PlanJson,
                StepCount = r.StepLogs.Count,
                TotalDurationMs = r.StepLogs.Sum(s => (long?)s.DurationMs) ?? 0
            })
            .ToListAsync(ct);

        var items = rows.Select(r =>
        {
            var (done, planTotal) = PlanProgress(r.PlanJson);
            return new AgentWorkflowRunListItemDto(
                r.Id, r.BookingId, r.BookingStatus, r.PackageName, r.TravelerName, r.Objective, r.Status,
                r.StartedAt, r.CompletedAt, done, planTotal, r.StepCount, r.TotalDurationMs);
        }).ToList();

        return new PagedResult<AgentWorkflowRunListItemDto>(items, total, page, pageSize);
    }

    public async Task<AgentWorkflowRunDetailDto?> GetDetailAsync(Guid runId, CancellationToken ct)
    {
        var run = await LoadRunAsync(runId, ct);
        if (run is null)
        {
            return null;
        }

        var steps = OrderedSteps(run);
        var latestId = await _db.AgentWorkflowRuns.AsNoTracking()
            .Where(r => r.BookingId == run.BookingId)
            .OrderByDescending(r => r.StartedAt).ThenByDescending(r => r.Id)
            .Select(r => r.Id)
            .FirstAsync(ct);
        var pending = await _db.ApprovalRequests.AsNoTracking()
            .Where(a => a.BookingId == run.BookingId && a.Status == ApprovalStatus.Pending)
            .Select(a => new PendingApprovalRefDto(a.Id, a.Type))
            .FirstOrDefaultAsync(ct);
        var (done, total) = PlanProgress(run.PlanJson);

        return new AgentWorkflowRunDetailDto(
            run.Id,
            run.BookingId,
            run.Booking.Status,
            run.Booking.TourPackage.Name,
            run.Booking.Traveler.Name,
            run.Objective,
            run.Status,
            run.StartedAt,
            run.CompletedAt,
            JsonRedactor.ParseAndRedact(run.PlanJson),
            done,
            total,
            steps.Select(s => new AgentWorkflowStepDetailDto(
                s.Id,
                s.AgentName,
                JsonRedactor.ParseAndRedact(s.InputJson),
                JsonRedactor.ParseAndRedact(s.OutputJson),
                JsonRedactor.ParseAndRedact(s.ToolCallsJson),
                s.ValidationResult,
                s.DurationMs,
                s.CreatedAt)).ToList(),
            run.SummaryText,
            AdvisoryFlags(steps),
            latestId == run.Id,
            pending);
    }

    public async Task<AgentWorkflowSummaryDto?> GetSummaryAsync(Guid runId, CancellationToken ct)
    {
        var run = await LoadRunAsync(runId, ct);
        if (run is null)
        {
            return null;
        }

        var steps = OrderedSteps(run);

        ManagerDecisionDto? decision = null;
        var decisionLog = steps.LastOrDefault(s => s.AgentName == "manager_decision");
        if (decisionLog is not null)
        {
            var input = ReadObject(decisionLog.InputJson);
            var output = ReadObject(decisionLog.OutputJson);
            decision = new ManagerDecisionDto(
                input?.GetStringOrNull("decision") ?? "Unknown",
                input?.GetStringOrNull("notes"),
                output?.GetStringOrNull("newStatus"),
                decisionLog.CreatedAt);
        }

        var validation = steps
            .LastOrDefault(s => s.AgentName == "PricingValidationAgent" && s.ValidationResult is not null)
            ?.ValidationResult;
        var toolCounts = steps.ToDictionary(s => s.Id, s => ToolCallCount(s.ToolCallsJson));

        return new AgentWorkflowSummaryDto(
            run.Id,
            run.BookingId,
            run.Status,
            run.StartedAt,
            run.CompletedAt,
            steps.Sum(s => s.DurationMs),
            steps.Count,
            toolCounts.Values.Sum(),
            validation,
            decision,
            run.SummaryText,
            AdvisoryFlags(steps),
            steps.Select(s => new AgentWorkflowSummaryStepDto(s.AgentName, s.DurationMs, s.ValidationResult, toolCounts[s.Id])).ToList());
    }

    private async Task<AgentWorkflowRun?> LoadRunAsync(Guid runId, CancellationToken ct) =>
        await _db.AgentWorkflowRuns
            .AsNoTracking()
            .Include(r => r.StepLogs)
            .Include(r => r.Booking).ThenInclude(b => b.TourPackage)
            .Include(r => r.Booking).ThenInclude(b => b.Traveler)
            .FirstOrDefaultAsync(r => r.Id == runId, ct);

    private static List<AgentStepLog> OrderedSteps(AgentWorkflowRun run) =>
        run.StepLogs.OrderBy(s => s.CreatedAt).ThenBy(s => s.Id).ToList();

    private static List<string> AdvisoryFlags(IEnumerable<AgentStepLog> steps)
    {
        var summaryLog = steps.LastOrDefault(s => s.AgentName == "ProposalSummaryAgent");
        if (summaryLog?.OutputJson is null)
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<ProposalSummary>(summaryLog.OutputJson, AgentJsonOptions.Default)?.AdvisoryFlags
                ?? new List<string>();
        }
        catch (JsonException)
        {
            return new List<string>();
        }
    }

    private static (int Done, int Total) PlanProgress(string? planJson)
    {
        if (string.IsNullOrWhiteSpace(planJson))
        {
            return (0, 0);
        }

        try
        {
            var plan = JsonSerializer.Deserialize<AgentWorkflowPlan>(planJson, AgentJsonOptions.Default);
            return plan is null
                ? (0, 0)
                : (plan.Steps.Count(s => string.Equals(s.Status, "done", StringComparison.OrdinalIgnoreCase)), plan.Steps.Count);
        }
        catch (JsonException)
        {
            return (0, 0);
        }
    }

    private static int ToolCallCount(string? toolCallsJson)
    {
        if (string.IsNullOrWhiteSpace(toolCallsJson))
        {
            return 0;
        }

        try
        {
            using var doc = JsonDocument.Parse(toolCallsJson);
            return doc.RootElement.ValueKind == JsonValueKind.Array ? doc.RootElement.GetArrayLength() : 0;
        }
        catch (JsonException)
        {
            return 0;
        }
    }

    private static JsonElement? ReadObject(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object ? doc.RootElement.Clone() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

internal static class JsonElementExtensions
{
    public static string? GetStringOrNull(this JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
