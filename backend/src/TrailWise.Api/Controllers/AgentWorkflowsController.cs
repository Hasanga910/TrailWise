using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.AgentWorkflows;
using TrailWise.Api.Contracts.Approvals;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Services;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/agent-workflows")]
[Authorize(Roles = ManagerRoles)]
public class AgentWorkflowsController : ControllerBase
{
    private const string ManagerRoles = "OperationsManager,FleetCoordinator,Admin";

    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    /// <summary>A run still marked Running after this long is treated as abandoned and may be re-run.</summary>
    private static readonly TimeSpan StaleRunAge = TimeSpan.FromMinutes(10);

    private readonly TrailWiseDbContext _db;
    private readonly AgentWorkflowQueryService _queries;
    private readonly ICoordinatorAgentService _coordinator;
    private readonly IApprovalService _approvals;
    private readonly IAuditLogService _audit;
    private readonly IClock _clock;
    private readonly ILogger<AgentWorkflowsController> _logger;

    public AgentWorkflowsController(
        TrailWiseDbContext db,
        AgentWorkflowQueryService queries,
        ICoordinatorAgentService coordinator,
        IApprovalService approvals,
        IAuditLogService audit,
        IClock clock,
        ILogger<AgentWorkflowsController> logger)
    {
        _db = db;
        _queries = queries;
        _coordinator = coordinator;
        _approvals = approvals;
        _audit = audit;
        _clock = clock;
        _logger = logger;
    }

    /// <summary>Workflow runs, newest first (workflow monitor). Filter by status or booking.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<AgentWorkflowRunListItemDto>>> List(
        [FromQuery] string? status,
        [FromQuery] Guid? bookingId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        CancellationToken ct = default)
    {
        var errors = new List<FieldValidationError>();
        if (!string.IsNullOrWhiteSpace(status)
            && !AgentWorkflowQueryService.KnownStatuses.Contains(status, StringComparer.OrdinalIgnoreCase))
        {
            errors.Add(new FieldValidationError("status", $"Status must be one of: {string.Join(", ", AgentWorkflowQueryService.KnownStatuses)}."));
        }

        if (page < 1)
        {
            errors.Add(new FieldValidationError("page", "Page must be greater than or equal to 1."));
        }

        if (pageSize < 1 || pageSize > MaxPageSize)
        {
            errors.Add(new FieldValidationError("pageSize", $"PageSize must be between 1 and {MaxPageSize}."));
        }

        if (errors.Count > 0)
        {
            return BadRequest(new { errors });
        }

        return Ok(await _queries.ListAsync(status, bookingId, page, pageSize, ct));
    }

    /// <summary>One run with its plan, every step (input, output, tool calls, validation, timing) and summary.</summary>
    [HttpGet("runs/{runId:guid}")]
    public async Task<ActionResult<AgentWorkflowRunDetailDto>> GetRun(Guid runId, CancellationToken ct)
    {
        var detail = await _queries.GetDetailAsync(runId, ct);
        return detail is null ? NotFound() : Ok(detail);
    }

    /// <summary>The auditable execution summary of a run: steps, tool calls, timings, validation, decision.</summary>
    [HttpGet("{id:guid}/summary")]
    public async Task<ActionResult<AgentWorkflowSummaryDto>> GetSummary(Guid id, CancellationToken ct)
    {
        var summary = await _queries.GetSummaryAsync(id, ct);
        return summary is null ? NotFound() : Ok(summary);
    }

    /// <summary>
    /// Re-runs the workflow for a booking in Requested or NeedsManualReview and returns the new run.
    /// The run executes inside the request.
    /// </summary>
    [HttpPost("start")]
    public async Task<ActionResult<AgentWorkflowRunDetailDto>> Start(StartAgentWorkflowRequest request, CancellationToken ct)
    {
        if (request.BookingId == Guid.Empty)
        {
            return BadRequest(new { errors = new[] { new FieldValidationError("bookingId", "BookingId is required.") } });
        }

        var performedBy = GetUserId();
        if (performedBy is null)
        {
            return Unauthorized();
        }

        var booking = await _db.Bookings.AsNoTracking().FirstOrDefaultAsync(b => b.Id == request.BookingId, ct);
        if (booking is null)
        {
            return NotFound();
        }

        if (booking.Status is not (BookingStatus.Requested or BookingStatus.NeedsManualReview))
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: $"A workflow can only be started for a booking that is Requested or NeedsManualReview (this one is {booking.Status}).");
        }

        var staleBefore = _clock.UtcNow - StaleRunAge;
        var alreadyRunning = await _db.AgentWorkflowRuns.AnyAsync(
            r => r.BookingId == booking.Id && r.Status == "Running" && r.StartedAt > staleBefore, ct);
        if (alreadyRunning)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "A workflow is already running for this booking.");
        }

        await _audit.LogAsync(
            entityType: "Booking",
            entityId: booking.Id,
            action: "AgentWorkflowStarted",
            performedBy: performedBy.Value,
            details: new { previousStatus = booking.Status.ToString() },
            ct: ct);

        try
        {
            // CancellationToken.None: a dropped connection must not leave the run half-way through.
            await _coordinator.StartWorkflowAsync(booking.Id, CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Coordinator workflow failed for booking {BookingId} when re-run", booking.Id);
            _db.ChangeTracker.Clear();
            var failed = await _db.Bookings.FirstOrDefaultAsync(b => b.Id == booking.Id, CancellationToken.None);
            if (failed is not null && failed.Status != BookingStatus.NeedsManualReview)
            {
                failed.Status = BookingStatus.NeedsManualReview;
                await _db.SaveChangesAsync(CancellationToken.None);
            }

            return Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "The workflow failed; the booking was left in NeedsManualReview.");
        }

        var latestRunId = await _db.AgentWorkflowRuns.AsNoTracking()
            .Where(r => r.BookingId == booking.Id)
            .OrderByDescending(r => r.StartedAt).ThenByDescending(r => r.Id)
            .Select(r => r.Id)
            .FirstAsync(ct);
        return Ok(await _queries.GetDetailAsync(latestRunId, ct));
    }

    /// <summary>
    /// Approves the booking this run is waiting on: delegates to the approvals decide logic
    /// (POST /api/approvals/{id}/decide with Approve). Operations Manager and Admin only.
    /// </summary>
    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "OperationsManager,Admin")]
    public async Task<ActionResult<ApprovalDecidedDto>> Approve(Guid id, ApproveAgentWorkflowRequest? request, CancellationToken ct)
    {
        var performedBy = GetUserId();
        if (performedBy is null)
        {
            return Unauthorized();
        }

        var run = await _db.AgentWorkflowRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (run is null)
        {
            return NotFound();
        }

        var latestRunId = await _db.AgentWorkflowRuns.AsNoTracking()
            .Where(r => r.BookingId == run.BookingId)
            .OrderByDescending(r => r.StartedAt).ThenByDescending(r => r.Id)
            .Select(r => r.Id)
            .FirstAsync(ct);
        if (latestRunId != run.Id)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This is not the latest workflow run for the booking.");
        }

        var approvalId = await _db.ApprovalRequests.AsNoTracking()
            .Where(a => a.BookingId == run.BookingId && a.Status == ApprovalStatus.Pending && a.Type != ApprovalType.RefundException)
            .Select(a => (Guid?)a.Id)
            .FirstOrDefaultAsync(ct);
        if (run.Status != "AwaitingApproval" || approvalId is null)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This workflow run is not waiting for approval.");
        }

        var result = await _approvals.DecideApprovalAsync(approvalId.Value, ApprovalDecision.Approve, request?.Note, performedBy.Value, ct);
        switch (result.Outcome)
        {
            case ApprovalOutcome.Success:
                var status = await _db.ApprovalRequests.AsNoTracking()
                    .Where(a => a.Id == approvalId.Value).Select(a => a.Status).SingleAsync(ct);
                return Ok(new ApprovalDecidedDto(approvalId.Value, status, BookingDto.FromEntity(result.Booking!)));
            case ApprovalOutcome.NotFound:
                return NotFound();
            case ApprovalOutcome.Invalid:
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: result.Error, detail: result.Error);
            default:
                return Problem(statusCode: StatusCodes.Status409Conflict, title: result.Error, detail: result.Error);
        }
    }

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }

    [HttpGet("{bookingId:guid}")]
    public async Task<ActionResult<AgentWorkflowDto>> GetByBookingId(Guid bookingId, CancellationToken ct)
    {
        var run = await _db.AgentWorkflowRuns
            .Include(r => r.StepLogs)
            .Where(r => r.BookingId == bookingId)
            .OrderByDescending(r => r.StartedAt)
            .FirstOrDefaultAsync(ct);

        if (run is null)
        {
            return NotFound();
        }

        var orderedLogs = run.StepLogs.OrderBy(s => s.CreatedAt).ToList();

        var advisoryFlags = orderedLogs
            .Where(s => s.AgentName == "ProposalSummaryAgent")
            .Select(s => JsonSerializer.Deserialize<ProposalSummary>(s.OutputJson!, AgentJsonOptions.Default))
            .FirstOrDefault(summary => summary is not null)
            ?.AdvisoryFlags ?? [];

        var steps = orderedLogs
            .Select(s => new AgentWorkflowStepDto(s.AgentName, s.DurationMs, ParseOutput(s.OutputJson)))
            .ToList();

        return Ok(new AgentWorkflowDto(
            run.BookingId,
            run.Status,
            run.SummaryText,
            advisoryFlags,
            run.StartedAt,
            run.CompletedAt,
            steps));
    }

    private static JsonElement? ParseOutput(string? outputJson) =>
        outputJson is null ? null : JsonSerializer.Deserialize<JsonElement>(outputJson, AgentJsonOptions.Default);
}
