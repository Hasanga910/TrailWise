using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Discounts;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/discounts")]
[Authorize(Roles = AllowedRoles)]
public class DiscountsController : ControllerBase
{
    private const string AllowedRoles = "Admin,OperationsManager";
    private readonly IDiscountService _discountService;

    public DiscountsController(IDiscountService discountService)
    {
        _discountService = discountService;
    }

    [HttpPost]
    public async Task<ActionResult<DiscountDto>> Create([FromBody] CreateDiscountRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("description", "Description is required.") }
            });
        }

        if (request.Description.Length > 200)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("description", "Description cannot exceed 200 characters.") }
            });
        }

        if (request.PercentageOff <= 0 || request.PercentageOff > 100)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("percentageOff", "PercentageOff must be greater than 0 and less than or equal to 100.") }
            });
        }

        if (request.MinGroupSize < 1)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("minGroupSize", "MinGroupSize must be at least 1.") }
            });
        }

        var userId = GetUserId();
        var discount = await _discountService.CreateAsync(
            request.Description.Trim(),
            request.PercentageOff,
            request.MinGroupSize,
            userId,
            ct);

        var dto = DiscountDto.FromEntity(discount);
        return CreatedAtAction(nameof(GetById), new { id = discount.Id }, dto);
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<DiscountDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? sortBy = "createdAt",
        [FromQuery] string? sortDirection = "desc",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        if (page < 1)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("page", "Page must be greater than or equal to 1.") }
            });
        }

        if (pageSize < 1)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("pageSize", "PageSize must be greater than or equal to 1.") }
            });
        }

        var result = await _discountService.GetAllAsync(search, sortBy, sortDirection, page, pageSize, ct);
        var dtos = result.Items.Select(DiscountDto.FromEntity).ToList();

        return Ok(new PagedResult<DiscountDto>(dtos, result.TotalCount, result.Page, result.PageSize));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DiscountDto>> GetById(Guid id, CancellationToken ct)
    {
        var discount = await _discountService.GetByIdAsync(id, ct);
        if (discount is null)
        {
            return NotFound();
        }

        return Ok(DiscountDto.FromEntity(discount));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<DiscountDto>> Update(Guid id, [FromBody] UpdateDiscountRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("description", "Description is required.") }
            });
        }

        if (request.Description.Length > 200)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("description", "Description cannot exceed 200 characters.") }
            });
        }

        if (request.PercentageOff <= 0 || request.PercentageOff > 100)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("percentageOff", "PercentageOff must be greater than 0 and less than or equal to 100.") }
            });
        }

        if (request.MinGroupSize < 1)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("minGroupSize", "MinGroupSize must be at least 1.") }
            });
        }

        var userId = GetUserId();
        var discount = await _discountService.UpdateAsync(
            id,
            request.Description.Trim(),
            request.PercentageOff,
            request.MinGroupSize,
            userId,
            ct);

        if (discount is null)
        {
            return NotFound();
        }

        return Ok(DiscountDto.FromEntity(discount));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        var deleted = await _discountService.DeleteAsync(id, userId, ct);
        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }
}
