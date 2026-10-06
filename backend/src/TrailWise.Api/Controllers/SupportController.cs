using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Support;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/support")]
[Authorize]
public class SupportController : ControllerBase
{
    private readonly ISupportService _supportService;

    public SupportController(ISupportService supportService)
    {
        _supportService = supportService;
    }

    [HttpPost("tickets")]
    [Authorize(Roles = nameof(UserRole.Traveler))]
    public async Task<ActionResult<SupportTicketDetailDto>> CreateTicket(
        [FromBody] CreateSupportTicketRequest request,
        CancellationToken ct)
    {
        var travelerId = GetUserId();
        if (travelerId is null)
        {
            return Unauthorized();
        }

        var result = await _supportService.CreateTicketAsync(
            travelerId.Value,
            request.BookingId,
            request.Category,
            request.Subject,
            request.Description,
            request.Priority,
            ct);

        if (!result.Succeeded)
        {
            return MapError(result.StatusCode, result.Error);
        }

        var dto = SupportTicketDetailDto.FromEntity(result.Ticket!);
        return CreatedAtAction(nameof(GetTicketById), new { id = dto.Id }, dto);
    }

    [HttpGet("tickets/mine")]
    [Authorize(Roles = nameof(UserRole.Traveler))]
    public async Task<ActionResult<PagedResult<SupportTicketListDto>>> GetMyTickets(
        [FromQuery] TicketStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var travelerId = GetUserId();
        if (travelerId is null)
        {
            return Unauthorized();
        }

        var result = await _supportService.GetMyTicketsAsync(travelerId.Value, status, page, pageSize, ct);
        var dtos = result.Items.Select(SupportTicketListDto.FromEntity).ToList();
        var paged = new PagedResult<SupportTicketListDto>(dtos, result.TotalCount, result.Page, result.PageSize);
        return Ok(paged);
    }

    [HttpGet("tickets/{id:guid}")]
    public async Task<ActionResult<SupportTicketDetailDto>> GetTicketById(
        Guid id,
        CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isStaff = User.IsInRole(nameof(UserRole.Admin)) || User.IsInRole(nameof(UserRole.OperationsManager));
        var result = await _supportService.GetTicketByIdAsync(id, userId.Value, isStaff, ct);
        if (!result.Succeeded)
        {
            return MapError(result.StatusCode, result.Error);
        }

        return Ok(SupportTicketDetailDto.FromEntity(result.Ticket!));
    }

    [HttpPost("tickets/{id:guid}/messages")]
    public async Task<ActionResult<SupportMessageDto>> AddMessage(
        Guid id,
        [FromBody] AddSupportMessageRequest request,
        CancellationToken ct)
    {
        var travelerId = GetUserId();
        if (travelerId is null)
        {
            return Unauthorized();
        }

        var result = await _supportService.AddTravelerMessageAsync(id, travelerId.Value, request.Message, ct);
        if (!result.Succeeded)
        {
            return MapError(result.StatusCode, result.Error);
        }

        return StatusCode(StatusCodes.Status201Created, SupportMessageDto.FromEntity(result.Message!));
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
