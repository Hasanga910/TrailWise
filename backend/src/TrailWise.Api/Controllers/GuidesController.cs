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
