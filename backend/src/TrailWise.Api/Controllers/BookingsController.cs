using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Api.Contracts.Common;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/bookings")]
[Authorize]
public class BookingsController : ControllerBase
{
    private const int MaxAdvanceBookingDays = 365;
    private const int DefaultPageSize = 10;
    private const int MaxPageSize = 50;

    private readonly TrailWiseDbContext _db;

    public BookingsController(TrailWiseDbContext db)
    {
        _db = db;
    }

    [HttpPost]
    public async Task<ActionResult<BookingDto>> Create(CreateBookingRequest request, CancellationToken ct)
    {
        var travelerId = GetUserId();
        if (travelerId is null)
        {
            return Unauthorized();
        }

        var tier = await _db.PackageTiers
            .Include(t => t.TourPackage)
            .FirstOrDefaultAsync(t => t.Id == request.PackageTierId, ct);

        if (tier is null)
        {
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Package tier not found.");
        }

        var errors = Validate(request, tier);
        if (errors.Count > 0)
        {
            return BadRequest(new { errors });
        }

        var booking = new Booking
        {
            TravelerId = travelerId.Value,
            TourPackageId = tier.TourPackageId,
            PackageTierId = tier.Id,
            GroupSize = request.GroupSize,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            BudgetPerPerson = request.BudgetPerPerson,
            // Large-group bookings (see BookingDto.IsLargeGroup) intentionally stay Requested here.
            // Routing them to PendingApproval is the future approval workflow/agent's responsibility,
            // not this endpoint's — there is currently no workflow that can move a booking back out
            // of PendingApproval, so setting it here would strand the booking in a dead-end state.
            Status = BookingStatus.Requested
        };

        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync(ct);

        booking.TourPackage = tier.TourPackage;
        booking.PackageTier = tier;

        return CreatedAtAction(nameof(GetById), new { id = booking.Id }, BookingDto.FromEntity(booking));
    }

    [HttpGet("mine")]
    public async Task<ActionResult<PagedResult<BookingDto>>> GetMine(
        BookingStatus? status,
        DateOnly? from,
        DateOnly? to,
        int page = 1,
        int pageSize = DefaultPageSize,
        CancellationToken ct = default)
    {
        var travelerId = GetUserId();
        if (travelerId is null)
        {
            return Unauthorized();
        }

        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("to", "'to' must be on or after 'from'.") }
            });
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = _db.Bookings
            .Include(b => b.TourPackage)
            .Include(b => b.PackageTier)
            .Where(b => b.TravelerId == travelerId.Value);

        if (status.HasValue)
        {
            query = query.Where(b => b.Status == status.Value);
        }

        if (from.HasValue)
        {
            query = query.Where(b => b.StartDate >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(b => b.StartDate <= to.Value);
        }

        var totalCount = await query.CountAsync(ct);

        var bookings = await query
            .OrderByDescending(b => b.StartDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        return Ok(new PagedResult<BookingDto>(
            bookings.Select(BookingDto.FromEntity).ToList(),
            totalCount,
            page,
            pageSize));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BookingDto>> GetById(Guid id, CancellationToken ct)
    {
        var booking = await _db.Bookings
            .Include(b => b.TourPackage)
            .Include(b => b.PackageTier)
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (booking is null)
        {
            return NotFound();
        }

        var travelerId = GetUserId();
        var isOwner = travelerId.HasValue && booking.TravelerId == travelerId.Value;
        var isManager = User.IsInRole("Admin") || User.IsInRole("OperationsManager");

        if (!isOwner && !isManager)
        {
            return Forbid();
        }

        return Ok(BookingDto.FromEntity(booking));
    }

    private static List<FieldValidationError> Validate(CreateBookingRequest request, PackageTier tier)
    {
        var errors = new List<FieldValidationError>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (request.GroupSize <= 0)
        {
            errors.Add(new FieldValidationError("groupSize", "Group size must be at least 1."));
        }
        else if (request.GroupSize > tier.TourPackage.MaxGroupSize)
        {
            errors.Add(new FieldValidationError(
                "groupSize",
                $"Group size cannot exceed {tier.TourPackage.MaxGroupSize} for this package."));
        }

        if (request.StartDate < today)
        {
            errors.Add(new FieldValidationError("startDate", "Start date cannot be in the past."));
        }
        else if (request.StartDate > today.AddDays(MaxAdvanceBookingDays))
        {
            errors.Add(new FieldValidationError(
                "startDate",
                $"Start date cannot be more than {MaxAdvanceBookingDays} days in the future."));
        }

        if (request.EndDate <= request.StartDate)
        {
            errors.Add(new FieldValidationError("endDate", "End date must be after the start date."));
        }

        if (request.BudgetPerPerson <= 0)
        {
            errors.Add(new FieldValidationError("budgetPerPerson", "Budget per person must be greater than 0."));
        }

        return errors;
    }

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }
}
