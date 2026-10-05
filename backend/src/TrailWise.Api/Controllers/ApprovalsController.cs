using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Approvals;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Api.Services;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

/// <summary>
/// Approval queue for the Operations Manager (design doc sections 5, 6 and 8.3). Admin is allowed
/// as the cross-cutting role.
/// </summary>
[ApiController]
[Route("api/approvals")]
[Authorize(Roles = "OperationsManager,Admin")]
public class ApprovalsController : ControllerBase
{
    private readonly ApprovalQueueService _queue;
    private readonly IApprovalService _approvals;
    private readonly TrailWiseDbContext _db;

    public ApprovalsController(ApprovalQueueService queue, IApprovalService approvals, TrailWiseDbContext db)
    {
        _queue = queue;
        _approvals = approvals;
        _db = db;
    }

    /// <summary>Open approvals (oldest first) with per-type counts and the evidence for each.</summary>
    [HttpGet("pending")]
    public async Task<ActionResult<PendingApprovalsDto>> GetPending([FromQuery] ApprovalType? type, CancellationToken ct) =>
        Ok(await _queue.GetPendingAsync(type, ct));

    /// <summary>Approve, reject or request a revision. A note is required to reject or request a revision.</summary>
    [HttpPost("{id:guid}/decide")]
    public async Task<ActionResult<ApprovalDecidedDto>> Decide(Guid id, ApprovalDecisionRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userId, out var performedBy))
        {
            return Unauthorized();
        }

        var result = await _approvals.DecideApprovalAsync(id, request.Decision, request.Note, performedBy, ct);

        switch (result.Outcome)
        {
            case ApprovalOutcome.Success:
                var status = await _db.ApprovalRequests.AsNoTracking()
                    .Where(a => a.Id == id).Select(a => a.Status).SingleAsync(ct);
                return Ok(new ApprovalDecidedDto(id, status, BookingDto.FromEntity(result.Booking!)));
            case ApprovalOutcome.NotFound:
                return NotFound();
            case ApprovalOutcome.Invalid:
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: result.Error, detail: result.Error);
            default:
                return Problem(statusCode: StatusCodes.Status409Conflict, title: result.Error, detail: result.Error);
        }
    }
}
