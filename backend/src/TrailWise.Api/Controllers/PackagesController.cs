using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Packages;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/packages")]
[Authorize]
public class PackagesController : ControllerBase
{
    private const string ManagerRoles = "OperationsManager,Admin";

    private readonly TrailWiseDbContext _db;

    public PackagesController(TrailWiseDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TourPackageDto>>> GetAll(CancellationToken ct)
    {
        var packages = await _db.TourPackages
            .Include(p => p.PackageTiers)
            .AsNoTracking()
            .ToListAsync(ct);

        return Ok(packages.Select(TourPackageDto.FromEntity).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TourPackageDto>> GetById(Guid id, CancellationToken ct)
    {
        var package = await _db.TourPackages
            .Include(p => p.PackageTiers)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (package is null)
        {
            return NotFound();
        }

        return Ok(TourPackageDto.FromEntity(package));
    }

    [HttpPost]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<TourPackageDto>> Create(CreatePackageRequest request, CancellationToken ct)
    {
        var package = new TourPackage
        {
            Name = request.Name,
            Theme = request.Theme,
            DurationDays = request.DurationDays,
            BasePricePerPerson = request.BasePricePerPerson,
            MaxGroupSize = request.MaxGroupSize
        };

        foreach (var tier in request.Tiers)
        {
            package.PackageTiers.Add(new PackageTier
            {
                ClassType = tier.ClassType,
                IncludesFood = tier.IncludesFood,
                BasePricePerPerson = tier.BasePricePerPerson,
                RequiresAC = tier.RequiresAC
            });
        }

        _db.TourPackages.Add(package);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = package.Id }, TourPackageDto.FromEntity(package));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<TourPackageDto>> Update(Guid id, UpdatePackageRequest request, CancellationToken ct)
    {
        var package = await _db.TourPackages
            .Include(p => p.PackageTiers)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (package is null)
        {
            return NotFound();
        }

        package.Name = request.Name;
        package.Theme = request.Theme;
        package.DurationDays = request.DurationDays;
        package.BasePricePerPerson = request.BasePricePerPerson;
        package.MaxGroupSize = request.MaxGroupSize;

        await _db.SaveChangesAsync(ct);

        return Ok(TourPackageDto.FromEntity(package));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var package = await _db.TourPackages
            .Include(p => p.PackageTiers)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (package is null)
        {
            return NotFound();
        }

        var hasBookings = await _db.Bookings.AnyAsync(b => b.TourPackageId == id, ct);
        if (hasBookings)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "This package has existing bookings and cannot be deleted.");
        }

        _db.TourPackages.Remove(package);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("{id:guid}/tiers")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<TourPackageDto>> AddTier(Guid id, CreatePackageTierRequest request, CancellationToken ct)
    {
        var package = await _db.TourPackages
            .Include(p => p.PackageTiers)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (package is null)
        {
            return NotFound();
        }

        // package is already tracked (loaded above), so a new child appended only via its
        // navigation collection can be misdetected as Modified rather than Added, because
        // BaseEntity pre-populates Id with a non-default Guid. Adding it to the DbSet directly
        // guarantees EF marks it Added.
        _db.PackageTiers.Add(new PackageTier
        {
            TourPackageId = package.Id,
            ClassType = request.ClassType,
            IncludesFood = request.IncludesFood,
            BasePricePerPerson = request.BasePricePerPerson,
            RequiresAC = request.RequiresAC
        });

        await _db.SaveChangesAsync(ct);

        return Ok(TourPackageDto.FromEntity(package));
    }
}
