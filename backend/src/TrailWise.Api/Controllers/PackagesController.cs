using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Packages;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/packages")]
[Authorize]
public class PackagesController : ControllerBase
{
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
}
