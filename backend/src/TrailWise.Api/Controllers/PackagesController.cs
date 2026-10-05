using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Packages;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Microsoft.Extensions.Options;

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
    private readonly IPackageLocationResolver _locationResolver;
    private readonly GeocodingOptions _geocoding;
    private readonly ILogger<PackagesController> _logger;

    public PackagesController(
        TrailWiseDbContext db,
        IWebHostEnvironment env,
        IPackageLocationResolver locationResolver,
        IOptions<GeocodingOptions> geocoding,
        ILogger<PackagesController> logger)
    {
        _db = db;
        _env = env;
        _locationResolver = locationResolver;
        _geocoding = geocoding.Value;
        _logger = logger;
    }

    /// <summary>
    /// Public catalogue. Text, theme, duration and group-size filters run in the database; tier,
    /// rating and sort run in memory on the loaded set, which is fine for a small catalogue. If the
    /// catalogue grows, move them into SQL and add paging (<c>PagedResult&lt;T&gt;</c> exists).
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    [EnableRateLimiting("PublicReadLimiter")]
    public async Task<ActionResult<IReadOnlyList<TourPackageDto>>> GetAll([FromQuery] PackageQuery query, CancellationToken ct)
    {
        if (query.MinDays > query.MaxDays)
            return ValidationProblem("minDays cannot be greater than maxDays.");
        if (query.MinPrice > query.MaxPrice)
            return ValidationProblem("minPrice cannot be greater than maxPrice.");

        var source = _db.TourPackages.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var q = query.Q.Trim().ToLower();
            source = source.Where(p =>
                p.Name.ToLower().Contains(q) ||
                p.Theme.ToLower().Contains(q) ||
                p.Locations.Any(l => l.Name.ToLower().Contains(q)));
        }

        if (!string.IsNullOrWhiteSpace(query.Theme))
        {
            var theme = query.Theme.Trim().ToLower();
            source = source.Where(p => p.Theme.ToLower() == theme);
        }

        if (query.MinDays.HasValue) source = source.Where(p => p.DurationDays >= query.MinDays.Value);
        if (query.MaxDays.HasValue) source = source.Where(p => p.DurationDays <= query.MaxDays.Value);
        if (query.Guests.HasValue) source = source.Where(p => p.MaxGroupSize >= query.Guests.Value);

        var packages = await source
            .Include(p => p.PackageTiers)
            .Include(p => p.Locations)
            .ToListAsync(ct);

        var reviewStats = await _db.Reviews
            .AsNoTracking()
            .GroupBy(r => r.Booking.TourPackageId)
            .Select(g => new
            {
                PackageId = g.Key,
                Count = g.Count(),
                Average = g.Average(r => r.Rating)
            })
            .ToDictionaryAsync(x => x.PackageId, ct);

        var rows = packages.Select(p =>
        {
            reviewStats.TryGetValue(p.Id, out var stat);
            var avg = stat != null && stat.Count > 0 ? Math.Round(stat.Average, 1) : 0.0;
            var count = stat?.Count ?? 0;
            return new TourPackageRow(p, avg, count, MatchingPrice(p, query));
        })
        .Where(r => r.MatchingPrice.HasValue || !query.HasTierFilters)
        .Where(r => !query.MinRating.HasValue || r.Average >= query.MinRating.Value);

        IEnumerable<TourPackageRow> result = rows;
        if (query.Sort.HasValue)
        {
            var descending = query.Dir == SortDirection.Desc || (query.Dir is null && query.Sort == PackageSort.Rating);
            var ordered = query.Sort.Value switch
            {
                PackageSort.Price => Order(rows, r => r.MatchingPrice ?? TourPackageDto.StartingPriceOf(r.Package), descending),
                PackageSort.Duration => Order(rows, r => r.Package.DurationDays, descending),
                PackageSort.Rating => Order(rows, r => r.Average, descending).ThenByDescending(r => r.Count),
                _ => Order(rows, r => r.Package.Name, descending)
            };
            result = ordered
                .ThenBy(r => r.Package.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(r => r.Package.Id);
        }

        var dtos = result
            .Select(r => TourPackageDto.FromEntity(r.Package, r.Average, r.Count))
            .ToList();

        return Ok(dtos);
    }

    private sealed record TourPackageRow(TourPackage Package, double Average, int Count, decimal? MatchingPrice);

    private static IOrderedEnumerable<T> Order<T, TKey>(IEnumerable<T> items, Func<T, TKey> key, bool descending) =>
        descending ? items.OrderByDescending(key) : items.OrderBy(key);

    /// <summary>
    /// The lowest price among the tiers that satisfy every tier-level filter (class, food, AC, price
    /// range), falling back to the base price when the package has no tiers and only a price filter
    /// is active. Null means the package does not match.
    /// </summary>
    private static decimal? MatchingPrice(TourPackage package, PackageQuery query)
    {
        if (!query.HasTierFilters) return TourPackageDto.StartingPriceOf(package);

        if (package.PackageTiers.Count == 0)
        {
            var onlyPriceFilters = !query.ClassType.HasValue && !query.IncludesFood.HasValue && !query.RequiresAC.HasValue;
            return onlyPriceFilters && InPriceRange(package.BasePricePerPerson, query) ? package.BasePricePerPerson : null;
        }

        var matching = package.PackageTiers.Where(t =>
            (!query.ClassType.HasValue || t.ClassType == query.ClassType.Value) &&
            (!query.IncludesFood.HasValue || t.IncludesFood == query.IncludesFood.Value) &&
            (!query.RequiresAC.HasValue || t.RequiresAC == query.RequiresAC.Value) &&
            InPriceRange(t.BasePricePerPerson, query)).ToList();

        return matching.Count == 0 ? null : matching.Min(t => t.BasePricePerPerson);
    }

    private static bool InPriceRange(decimal price, PackageQuery query) =>
        (!query.MinPrice.HasValue || price >= query.MinPrice.Value) &&
        (!query.MaxPrice.HasValue || price <= query.MaxPrice.Value);

    /// <summary>Options and bounds for the public explorer's filter bar.</summary>
    [HttpGet("facets")]
    [AllowAnonymous]
    [EnableRateLimiting("PublicReadLimiter")]
    public async Task<ActionResult<PackageFacetsDto>> GetFacets(CancellationToken ct)
    {
        var packages = await _db.TourPackages
            .AsNoTracking()
            .Include(p => p.PackageTiers)
            .ToListAsync(ct);

        if (packages.Count == 0)
            return Ok(new PackageFacetsDto(Array.Empty<string>(), 0, 0, 0, 0, 0));

        var prices = packages
            .SelectMany(p => p.PackageTiers.Count > 0
                ? p.PackageTiers.Select(t => t.BasePricePerPerson)
                : new[] { p.BasePricePerPerson })
            .ToList();

        var themes = packages
            .Select(p => p.Theme.Trim())
            .Where(t => t.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(t => t, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return Ok(new PackageFacetsDto(
            themes,
            prices.Min(),
            prices.Max(),
            packages.Min(p => p.DurationDays),
            packages.Max(p => p.DurationDays),
            packages.Max(p => p.MaxGroupSize)));
    }

    /// <summary>
    /// Checks that every manual coordinate refers to a listed location, appears once, and is in range
    /// (range and both-or-neither are enforced by model validation). Returns an error message or null.
    /// </summary>
    private static string? ValidateCoordinates(
        IEnumerable<string> locationNames,
        IEnumerable<LocationCoordinateRequest>? coordinates,
        out Dictionary<string, GeocodedPoint> manual)
    {
        manual = new Dictionary<string, GeocodedPoint>();
        if (coordinates is null) return null;

        var names = locationNames.Select(n => n.Trim().ToLowerInvariant()).ToHashSet();
        foreach (var c in coordinates)
        {
            var key = c.Name.Trim().ToLowerInvariant();
            if (!names.Contains(key))
                return $"Coordinates were given for '{c.Name.Trim()}', which is not in LocationNames.";
            if (!manual.TryAdd(key, new GeocodedPoint(c.Latitude!.Value, c.Longitude!.Value)))
                return $"Coordinates for '{c.Name.Trim()}' were given more than once.";
        }
        return null;
    }

    /// <summary>
    /// Fills missing coordinates through the geocoder without ever blocking or failing the save:
    /// lookups are capped, time-boxed and any error is logged and ignored.
    /// </summary>
    private async Task ResolveCoordinatesBestEffortAsync(IReadOnlyCollection<PackageLocation> locations, CancellationToken ct)
    {
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        budget.CancelAfter(TimeSpan.FromSeconds(_geocoding.SaveTimeBudgetSeconds));
        try
        {
            await _locationResolver.ResolveAsync(locations, _geocoding.MaxLookupsPerSave, budget.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            _logger.LogWarning("Geocoding exceeded its time budget while saving a package; remaining locations stay off the map.");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Geocoding failed while saving a package; continuing without coordinates.");
        }
    }

    /// <summary>
    /// Admin/ops backfill: geocodes up to a batch of existing locations that have no coordinates. Repeat with
    /// <c>skip = nextSkip</c> until <c>remaining</c> is 0. Locations that cannot be found keep null coordinates
    /// (they are skipped via <c>nextSkip</c>) and are reported in <c>notFound</c>.
    /// </summary>
    [HttpPost("geocode-missing")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<GeocodeBackfillResultDto>> GeocodeMissing([FromQuery] int skip = 0, CancellationToken ct = default)
    {
        if (skip < 0) return ValidationProblem("skip cannot be negative.");

        var pending = _db.PackageLocations
            .Where(l => l.Latitude == null && l.Longitude == null)
            .OrderBy(l => l.Name)
            .ThenBy(l => l.Id);

        var total = await pending.CountAsync(ct);
        var batch = await pending.Skip(skip).Take(_geocoding.BackfillBatchSize).ToListAsync(ct);

        // Rows with the same name are resolved together, so never split a name across two calls' lookups.
        var resolution = await _locationResolver.ResolveAsync(batch, int.MaxValue, ct);
        await _db.SaveChangesAsync(ct);

        var notFoundRows = batch.Count(l => l.Latitude is null);
        var remaining = Math.Max(0, total - skip - batch.Count);
        return Ok(new GeocodeBackfillResultDto(
            batch.Count,
            resolution.Updated,
            resolution.NotFound,
            remaining,
            skip + notFoundRows));
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    [EnableRateLimiting("PublicReadLimiter")]
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

        var stat = await _db.Reviews
            .AsNoTracking()
            .Where(r => r.Booking.TourPackageId == id)
            .GroupBy(r => r.Booking.TourPackageId)
            .Select(g => new
            {
                Count = g.Count(),
                Average = g.Average(r => r.Rating)
            })
            .FirstOrDefaultAsync(ct);

        var avg = stat != null && stat.Count > 0 ? Math.Round(stat.Average, 1) : 0.0;
        var count = stat?.Count ?? 0;

        return Ok(TourPackageDto.FromEntity(package, avg, count));
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

        var coordinateError = ValidateCoordinates(request.LocationNames, request.LocationCoordinates, out var manual);
        if (coordinateError is not null) return ValidationProblem(coordinateError);

        foreach (var locationName in request.LocationNames)
        {
            var name = locationName.Trim();
            manual.TryGetValue(name.ToLowerInvariant(), out var point);
            package.Locations.Add(new PackageLocation { Name = name, Latitude = point?.Latitude, Longitude = point?.Longitude });
        }

        await ResolveCoordinatesBestEffortAsync(package.Locations.ToList(), ct);

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

        // package is already tracked (loaded above), so replacing Locations purely via the
        // navigation collection misdetects the new entries as Modified rather than Added, because
        // BaseEntity pre-populates Id with a non-default Guid (same issue worked around in AddTier
        // below). Removing/adding through the DbSet directly guarantees EF tracks each side correctly.
        // Coordinates survive the replace: request values win, then whatever the unchanged name already had.
        var previous = package.Locations
            .Where(l => l.Latitude.HasValue && l.Longitude.HasValue)
            .GroupBy(l => l.Name.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => new GeocodedPoint(g.First().Latitude!.Value, g.First().Longitude!.Value));

        var coordinateError = ValidateCoordinates(request.LocationNames, request.LocationCoordinates, out var manual);
        if (coordinateError is not null) return ValidationProblem(coordinateError);

        _db.PackageLocations.RemoveRange(package.Locations);
        package.Locations.Clear();
        var replacements = new List<PackageLocation>();
        foreach (var locationName in request.LocationNames)
        {
            var name = locationName.Trim();
            var key = name.ToLowerInvariant();
            var point = manual.TryGetValue(key, out var m) ? m : previous.GetValueOrDefault(key);
            var location = new PackageLocation { TourPackageId = package.Id, Name = name, Latitude = point?.Latitude, Longitude = point?.Longitude };
            replacements.Add(location);
            _db.PackageLocations.Add(location);
        }

        await ResolveCoordinatesBestEffortAsync(replacements, ct);

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
