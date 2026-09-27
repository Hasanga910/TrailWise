using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Discounts;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/discounts")]
[Authorize]
public class DiscountsController : ControllerBase
{
    private const string ManagerRoles = "OperationsManager,Admin";

    private readonly TrailWiseDbContext _db;

    public DiscountsController(TrailWiseDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<IReadOnlyList<DiscountDto>>> GetAll(CancellationToken ct)
    {
        var discounts = await _db.Discounts
            .OrderBy(d => d.MinGroupSize)
            .AsNoTracking()
            .ToListAsync(ct);

        return Ok(discounts.Select(DiscountDto.FromEntity).ToList());
    }

    [HttpPost]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<DiscountDto>> Create(CreateDiscountRequest request, CancellationToken ct)
    {
        var discount = new Discount
        {
            Description = request.Description.Trim(),
            PercentageOff = request.PercentageOff,
            MinGroupSize = request.MinGroupSize
        };

        _db.Discounts.Add(discount);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetAll), new { }, DiscountDto.FromEntity(discount));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var discount = await _db.Discounts.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (discount is null)
        {
            return NotFound();
        }

        _db.Discounts.Remove(discount);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }
}
