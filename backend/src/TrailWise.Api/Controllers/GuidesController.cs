using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Guides;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/guides")]
[Authorize]
public class GuidesController : ControllerBase
{
    private const string OperationsManagerOrAdmin = "OperationsManager,Admin";

    private readonly TrailWiseDbContext _db;
    private readonly ILogger<GuidesController> _logger;

    public GuidesController(TrailWiseDbContext db, ILogger<GuidesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GuideDto>>> GetAll(
        [FromQuery] string? specialization,
        [FromQuery] string? language,
        CancellationToken ct)
    {
        var guides = await _db.Guides
            .AsNoTracking()
            .OrderBy(g => g.Name)
            .ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(specialization))
        {
            var specTrimmed = specialization.Trim();
            guides = guides
                .Where(g => g.Specializations.Any(s => string.Equals(s, specTrimmed, StringComparison.OrdinalIgnoreCase)))
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(language))
        {
            var langTrimmed = language.Trim();
            guides = guides
                .Where(g => g.Languages.Any(l => string.Equals(l, langTrimmed, StringComparison.OrdinalIgnoreCase)))
                .ToList();
        }

        return Ok(guides.Select(GuideDto.FromEntity).ToList());
    }

    [HttpGet("me/assigned-tours")]
    [Authorize(Roles = "TourGuide")]
    public async Task<ActionResult<IReadOnlyList<AssignedTourDto>>> GetMyAssignedTours(CancellationToken ct)
    {
        var currentUserId = GetUserId();
        if (currentUserId is null)
        {
            return Unauthorized();
        }

        var guide = await _db.Guides
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.UserId == currentUserId.Value, ct);

        if (guide is null)
        {
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Guide profile not found for current user.");
        }

        var bookings = await _db.Bookings
            .AsNoTracking()
            .Where(b => b.GuideAvailabilities.Any(g => g.GuideId == guide.Id))
            .Include(b => b.TourPackage)
                .ThenInclude(p => p.Locations)
            .OrderBy(b => b.StartDate)
            .ThenBy(b => b.Id)
            .ToListAsync(ct);

        var result = bookings
            .Select(b => AssignedTourDto.FromEntity(b, guide))
            .ToList();

        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<GuideDto>> GetById(Guid id, CancellationToken ct)
    {
        var guide = await _db.Guides
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == id, ct);

        if (guide is null)
        {
            return NotFound();
        }

        return Ok(GuideDto.FromEntity(guide));
    }

    [HttpPost]
    [Authorize(Roles = OperationsManagerOrAdmin)]
    public async Task<ActionResult<GuideDto>> Create(CreateGuideRequest request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { errors = new[] { new FieldValidationError("name", "Guide name is required.") } });
        }

        if (name.Length > 200)
        {
            return BadRequest(new { errors = new[] { new FieldValidationError("name", "Guide name cannot exceed 200 characters.") } });
        }

        var contactInfo = request.ContactInfo?.Trim() ?? string.Empty;
        if (contactInfo.Length > 200)
        {
            return BadRequest(new { errors = new[] { new FieldValidationError("contactInfo", "Contact info cannot exceed 200 characters.") } });
        }

        if (request.UserId.HasValue)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId.Value, ct);
            if (user is null)
            {
                return BadRequest(new { errors = new[] { new FieldValidationError("userId", "Referenced user does not exist.") } });
            }

            if (user.Role != UserRole.TourGuide)
            {
                return BadRequest(new { errors = new[] { new FieldValidationError("userId", "The referenced user must have the TourGuide role.") } });
            }

            var alreadyLinked = await _db.Guides.AnyAsync(g => g.UserId == request.UserId.Value, ct);
            if (alreadyLinked)
            {
                return BadRequest(new { errors = new[] { new FieldValidationError("userId", "This user is already linked to another guide profile.") } });
            }
        }

        var languages = NormalizeArray(request.Languages);
        var specializations = NormalizeArray(request.Specializations);

        var guide = new Guide
        {
            Name = name,
            Languages = languages,
            Specializations = specializations,
            ContactInfo = contactInfo,
            UserId = request.UserId
        };

        _db.Guides.Add(guide);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (request.UserId.HasValue && _db.Guides.Any(g => g.UserId == request.UserId.Value))
        {
            return BadRequest(new { errors = new[] { new FieldValidationError("userId", "This user is already linked to another guide profile.") } });
        }

        _logger.LogInformation("Guide {GuideId} created.", guide.Id);

        return CreatedAtAction(nameof(GetById), new { id = guide.Id }, GuideDto.FromEntity(guide));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = OperationsManagerOrAdmin)]
    public async Task<ActionResult<GuideDto>> Update(Guid id, UpdateGuideRequest request, CancellationToken ct)
    {
        var guide = await _db.Guides.FirstOrDefaultAsync(g => g.Id == id, ct);
        if (guide is null)
        {
            return NotFound();
        }

        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { errors = new[] { new FieldValidationError("name", "Guide name is required.") } });
        }

        if (name.Length > 200)
        {
            return BadRequest(new { errors = new[] { new FieldValidationError("name", "Guide name cannot exceed 200 characters.") } });
        }

        var contactInfo = request.ContactInfo?.Trim() ?? string.Empty;
        if (contactInfo.Length > 200)
        {
            return BadRequest(new { errors = new[] { new FieldValidationError("contactInfo", "Contact info cannot exceed 200 characters.") } });
        }

        if (request.UserId.HasValue && request.UserId.Value != guide.UserId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId.Value, ct);
            if (user is null)
            {
                return BadRequest(new { errors = new[] { new FieldValidationError("userId", "Referenced user does not exist.") } });
            }

            if (user.Role != UserRole.TourGuide)
            {
                return BadRequest(new { errors = new[] { new FieldValidationError("userId", "The referenced user must have the TourGuide role.") } });
            }

            var alreadyLinked = await _db.Guides.AnyAsync(g => g.Id != id && g.UserId == request.UserId.Value, ct);
            if (alreadyLinked)
            {
                return BadRequest(new { errors = new[] { new FieldValidationError("userId", "This user is already linked to another guide profile.") } });
            }
        }

        guide.Name = name;
        guide.ContactInfo = contactInfo;
        guide.Languages = NormalizeArray(request.Languages);
        guide.Specializations = NormalizeArray(request.Specializations);
        guide.UserId = request.UserId;

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (request.UserId.HasValue && _db.Guides.Any(g => g.Id != id && g.UserId == request.UserId.Value))
        {
            return BadRequest(new { errors = new[] { new FieldValidationError("userId", "This user is already linked to another guide profile.") } });
        }

        _logger.LogInformation("Guide {GuideId} updated.", guide.Id);

        return Ok(GuideDto.FromEntity(guide));
    }

    [HttpGet("{id:guid}/availability")]
    public async Task<ActionResult<IReadOnlyList<GuideAvailabilityDto>>> GetAvailability(
        Guid id,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken ct)
    {
        var guideExists = await _db.Guides.AsNoTracking().AnyAsync(g => g.Id == id, ct);
        if (!guideExists)
        {
            return NotFound();
        }

        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("to", "'to' must be on or after 'from'.") }
            });
        }

        var query = _db.GuideAvailabilities
            .AsNoTracking()
            .Where(a => a.GuideId == id);

        if (from.HasValue)
        {
            query = query.Where(a => a.Date >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(a => a.Date <= to.Value);
        }

        var availabilities = await query
            .OrderBy(a => a.Date)
            .ToListAsync(ct);

        return Ok(availabilities.Select(GuideAvailabilityDto.FromEntity).ToList());
    }

    [HttpPut("{id:guid}/availability")]
    [Authorize(Roles = "TourGuide")]
    public async Task<ActionResult<IReadOnlyList<GuideAvailabilityDto>>> UpdateAvailability(
        Guid id,
        UpdateGuideAvailabilityRequest request,
        CancellationToken ct)
    {
        var currentUserId = GetUserId();
        if (currentUserId is null)
        {
            return Unauthorized();
        }

        var guide = await _db.Guides.FirstOrDefaultAsync(g => g.Id == id, ct);
        if (guide is null)
        {
            return NotFound();
        }

        if (guide.UserId != currentUserId.Value)
        {
            return Forbid();
        }

        if (request.Dates is null || request.Dates.Count == 0)
        {
            return Ok(new List<GuideAvailabilityDto>());
        }

        var duplicateDates = request.Dates
            .GroupBy(d => d.Date)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        if (duplicateDates.Count > 0)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("dates", "Duplicate dates supplied in request.") }
            });
        }

        var targetDates = request.Dates.Select(d => d.Date).ToList();
        var existingRows = await _db.GuideAvailabilities
            .Where(a => a.GuideId == id && targetDates.Contains(a.Date))
            .ToListAsync(ct);

        var existingDict = existingRows.ToDictionary(a => a.Date);

        // Verify that no date with an assigned booking is being marked as available
        foreach (var item in request.Dates)
        {
            if (existingDict.TryGetValue(item.Date, out var existing))
            {
                if (existing.AssignedBookingId != null && item.IsAvailable)
                {
                    return BadRequest(new
                    {
                        errors = new[]
                        {
                            new FieldValidationError(
                                "dates",
                                $"Date {item.Date:yyyy-MM-dd} is assigned to booking {existing.AssignedBookingId} and cannot be marked available.")
                        }
                    });
                }
            }
        }

        foreach (var item in request.Dates)
        {
            if (existingDict.TryGetValue(item.Date, out var existing))
            {
                existing.IsAvailable = item.IsAvailable;
            }
            else
            {
                var newRow = new GuideAvailability
                {
                    GuideId = id,
                    Date = item.Date,
                    IsAvailable = item.IsAvailable
                };
                _db.GuideAvailabilities.Add(newRow);
            }
        }

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            await _db.SaveChangesAsync(ct);
            if (transaction is not null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        var updatedRows = await _db.GuideAvailabilities
            .AsNoTracking()
            .Where(a => a.GuideId == id && targetDates.Contains(a.Date))
            .OrderBy(a => a.Date)
            .ToListAsync(ct);

        return Ok(updatedRows.Select(GuideAvailabilityDto.FromEntity).ToList());
    }

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }

    private static string[] NormalizeArray(string[]? input)
    {
        if (input is null || input.Length == 0)
        {
            return Array.Empty<string>();
        }

        return input
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }
}
