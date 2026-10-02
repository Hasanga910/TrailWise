using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.AgentWorkflows;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/agent-workflows")]
[Authorize(Roles = ManagerRoles)]
public class AgentWorkflowsController : ControllerBase
{
    private const string ManagerRoles = "OperationsManager,FleetCoordinator,Admin";

    private readonly TrailWiseDbContext _db;

    public AgentWorkflowsController(TrailWiseDbContext db)
    {
        _db = db;
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
