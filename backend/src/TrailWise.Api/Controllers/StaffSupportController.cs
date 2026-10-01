using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Support;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/staff/support")]
[Authorize(Roles = "OperationsManager,Admin")]
public class StaffSupportController : ControllerBase
{
    private readonly ISupportService _supportService;

    public StaffSupportController(ISupportService supportService)
    {
        _supportService = supportService;
    }

    [HttpGet("tickets")]
    public async Task<ActionResult<PagedResult<SupportTicketListDto>>> GetTickets(
        [FromQuery] TicketStatus? status,
        [FromQuery] TicketCategory? category,
        [FromQuery] TicketPriority? priority,
        [FromQuery] Guid? assignedToId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var result = await _supportService.GetStaffTicketsAsync(
            status, category, priority, assignedToId, search, page, pageSize, ct);

        var dtos = result.Items.Select(SupportTicketListDto.FromEntity).ToList();
        var paged = new PagedResult<SupportTicketListDto>(dtos, result.TotalCount, result.Page, result.PageSize);
        return Ok(paged);
    }

    [HttpGet("tickets/{id:guid}")]
    public async Task<ActionResult<SupportTicketDetailDto>> GetTicketById(
        Guid id,
        CancellationToken ct)
    {
        var staffId = GetUserId();
        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _supportService.GetTicketByIdAsync(id, staffId.Value, isStaff: true, ct);
        if (!result.Succeeded)
        {
            return MapError(result.StatusCode, result.Error);
        }

        return Ok(SupportTicketDetailDto.FromEntity(result.Ticket!));
    }

    [HttpPost("tickets/{id:guid}/messages")]
    public async Task<ActionResult<SupportMessageDto>> AddStaffMessage(
        Guid id,
        [FromBody] AddSupportMessageRequest request,
        CancellationToken ct)
    {
        var staffId = GetUserId();
        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _supportService.AddStaffMessageAsync(id, staffId.Value, request.Message, ct);
        if (!result.Succeeded)
        {
            return MapError(result.StatusCode, result.Error);
        }

        return StatusCode(StatusCodes.Status201Created, SupportMessageDto.FromEntity(result.Message!));
    }

    [HttpPatch("tickets/{id:guid}/status")]
    public async Task<ActionResult<SupportTicketDetailDto>> UpdateStatus(
        Guid id,
        [FromBody] UpdateSupportStatusRequest request,
        CancellationToken ct)
    {
        var staffId = GetUserId();
        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _supportService.UpdateStatusAsync(id, staffId.Value, request.Status, ct);
        if (!result.Succeeded)
        {
            return MapError(result.StatusCode, result.Error);
        }

        return Ok(SupportTicketDetailDto.FromEntity(result.Ticket!));
    }

    [HttpPatch("tickets/{id:guid}/assign")]
    public async Task<ActionResult<SupportTicketDetailDto>> AssignTicket(
        Guid id,
        [FromBody] AssignSupportTicketRequest request,
        CancellationToken ct)
    {
        var staffId = GetUserId();
        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _supportService.AssignTicketAsync(id, staffId.Value, request.AssignedToId, ct);
        if (!result.Succeeded)
        {
            return MapError(result.StatusCode, result.Error);
        }

        return Ok(SupportTicketDetailDto.FromEntity(result.Ticket!));
    }

    [HttpPatch("tickets/{id:guid}/priority")]
    public async Task<ActionResult<SupportTicketDetailDto>> UpdatePriority(
        Guid id,
        [FromBody] UpdateSupportPriorityRequest request,
        CancellationToken ct)
    {
        var staffId = GetUserId();
        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _supportService.UpdatePriorityAsync(id, staffId.Value, request.Priority, ct);
        if (!result.Succeeded)
        {
            return MapError(result.StatusCode, result.Error);
        }

        return Ok(SupportTicketDetailDto.FromEntity(result.Ticket!));
    }

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }

    private ActionResult MapError(int statusCode, string? error) => statusCode switch
    {
        StatusCodes.Status404NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: error),
        StatusCodes.Status403Forbidden => Forbid(),
        StatusCodes.Status409Conflict => Problem(statusCode: StatusCodes.Status409Conflict, title: error),
        _ => BadRequest(new { message = error })
    };
}
