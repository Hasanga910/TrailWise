using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
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
    private const long MaxPhotoSizeBytes = 5 * 1024 * 1024;
    private static readonly Dictionary<string, string> AllowedPhotoContentTypes = new()
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp"
    };

    private readonly TrailWiseDbContext _db;
    private readonly IWebHostEnvironment _env;

    public PackagesController(TrailWiseDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TourPackageDto>>> GetAll(CancellationToken ct)
    {
        var packages = await _db.TourPackages
            .Include(p => p.PackageTiers)
            .Include(p => p.Locations)
            .AsNoTracking()
            .ToListAsync(ct);

        return Ok(packages.Select(TourPackageDto.FromEntity).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TourPackageDto>> GetById(Guid id, CancellationToken ct)
    {
        var package = await _db.TourPackages
            .Include(p => p.PackageTiers)
            .Include(p => p.Locations)
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

        foreach (var locationName in request.LocationNames)
        {
            package.Locations.Add(new PackageLocation { Name = locationName.Trim() });
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
            .Include(p => p.Locations)
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

        package.Locations.Clear();
        foreach (var locationName in request.LocationNames)
        {
            package.Locations.Add(new PackageLocation { Name = locationName.Trim() });
        }

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

        DeletePhotoFile(package.PhotoUrl);

        _db.TourPackages.Remove(package);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("{id:guid}/photo")]
    [Authorize(Roles = ManagerRoles)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxPhotoSizeBytes)]
    public async Task<ActionResult<TourPackageDto>> UploadPhoto(Guid id, IFormFile? photo, CancellationToken ct)
    {
        var package = await _db.TourPackages
            .Include(p => p.PackageTiers)
            .Include(p => p.Locations)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (package is null)
        {
            return NotFound();
        }

        if (photo is null || photo.Length == 0)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Photo is required.");
        }

        if (photo.Length > MaxPhotoSizeBytes)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Photo must be 5MB or smaller.");
        }

        if (!AllowedPhotoContentTypes.TryGetValue(photo.ContentType, out var extension))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Only JPG, PNG, or WEBP images are allowed.");
        }

        DeletePhotoFile(package.PhotoUrl);

        var uploadsDir = Path.Combine(_env.WebRootPath, "uploads", "packages");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(uploadsDir, fileName);

        await using (var stream = System.IO.File.Create(filePath))
        {
            await photo.CopyToAsync(stream, ct);
        }

        package.PhotoUrl = $"/uploads/packages/{fileName}";
        await _db.SaveChangesAsync(ct);

        return Ok(TourPackageDto.FromEntity(package));
    }

    private void DeletePhotoFile(string? photoUrl)
    {
        if (string.IsNullOrEmpty(photoUrl))
        {
            return;
        }

        var filePath = Path.Combine(_env.WebRootPath, photoUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
        if (System.IO.File.Exists(filePath))
        {
            System.IO.File.Delete(filePath);
        }
    }

    [HttpPost("{id:guid}/tiers")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<TourPackageDto>> AddTier(Guid id, CreatePackageTierRequest request, CancellationToken ct)
    {
        var package = await _db.TourPackages
            .Include(p => p.PackageTiers)
            .Include(p => p.Locations)
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
