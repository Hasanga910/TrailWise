using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrailWise.Api.Contracts.Discounts;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/discounts")]
[Authorize]
public class DiscountsController : ControllerBase
{
    private const string ManagerRoles = "OperationsManager,Admin";

    private readonly IDiscountService _discountService;

    public DiscountsController(IDiscountService discountService)
    {
        _discountService = discountService;
    }

    [HttpGet]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<IReadOnlyList<DiscountDto>>> GetAll(CancellationToken ct)
    {
        var discounts = await _discountService.GetAllListAsync(ct);
        return Ok(discounts.Select(DiscountDto.FromEntity).ToList());
    }

    [HttpGet("active")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<ActiveDiscountDto>>> GetActive(CancellationToken ct)
    {
        var activeDiscounts = await _discountService.GetActiveDiscountsAsync(ct: ct);
        return Ok(activeDiscounts.Select(ActiveDiscountDto.FromEntity).ToList());
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<DiscountDto>> GetById(Guid id, CancellationToken ct)
    {
        var discount = await _discountService.GetByIdAsync(id, ct);
        if (discount is null)
        {
            return NotFound();
        }

        return Ok(DiscountDto.FromEntity(discount));
    }

    [HttpPost]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<DiscountDto>> Create(CreateDiscountRequest request, CancellationToken ct)
    {
        try
        {
            var discount = await _discountService.CreateAsync(
                request.Description,
                request.PercentageOff,
                request.MinGroupSize,
                request.IsActive,
                request.ValidFrom,
                request.ValidUntil,
                GetUserId(),
                ct);

            return CreatedAtAction(nameof(GetById), new { id = discount.Id }, DiscountDto.FromEntity(discount));
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<DiscountDto>> Update(Guid id, UpdateDiscountRequest request, CancellationToken ct)
    {
        try
        {
            var discount = await _discountService.UpdateAsync(
                id,
                request.Description,
                request.PercentageOff,
                request.MinGroupSize,
                request.IsActive,
                request.ValidFrom,
                request.ValidUntil,
                GetUserId(),
                ct);

            if (discount is null)
            {
                return NotFound();
            }

            return Ok(DiscountDto.FromEntity(discount));
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/active")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<DiscountDto>> ToggleActive(Guid id, ToggleDiscountActiveRequest request, CancellationToken ct)
    {
        var discount = await _discountService.ToggleActiveAsync(id, request.IsActive, GetUserId(), ct);
        if (discount is null)
        {
            return NotFound();
        }

        return Ok(DiscountDto.FromEntity(discount));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _discountService.DeleteAsync(id, GetUserId(), ct);
        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }
}
