using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Guides;
using TrailWise.Api.Contracts.Itineraries;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/bookings")]
[Authorize]
public class BookingsController : ControllerBase
{
    private const int MaxAdvanceBookingDays = 365;
    private const int DefaultPageSize = 10;
    private const int MaxPageSize = 50;
    private const int MaxSpecialRequestsLength = 1000;

    private readonly TrailWiseDbContext _db;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IItineraryService _itineraryService;
    private readonly ILogger<BookingsController> _logger;

    public BookingsController(
        TrailWiseDbContext db,
        IServiceScopeFactory scopeFactory,
        IItineraryService itineraryService,
        ILogger<BookingsController> logger)
    {
        _db = db;
        _scopeFactory = scopeFactory;
        _itineraryService = itineraryService;
        _logger = logger;
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
            SpecialRequests = string.IsNullOrWhiteSpace(request.SpecialRequests) ? null : request.SpecialRequests.Trim(),
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

        DispatchCoordinatorWorkflow(booking.Id);

        return CreatedAtAction(nameof(GetById), new { id = booking.Id }, BookingDto.FromEntity(booking));
    }

    private void DispatchCoordinatorWorkflow(Guid bookingId)
    {
        try
        {
            _ = Task.Run(async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                try
                {
                    var coordinator = scope.ServiceProvider.GetRequiredService<ICoordinatorAgentService>();
                    // Deliberately CancellationToken.None: the HTTP request's `ct` will be cancelled
                    // once the response is returned, long before this background work finishes.
                    await coordinator.StartWorkflowAsync(bookingId, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Coordinator workflow failed for booking {BookingId}", bookingId);
                    await MarkBookingNeedsManualReviewAsync(bookingId);
                }
            });
        }
        catch (Exception ex)
        {
            // Scheduling itself should never fail booking creation, which has already succeeded.
            _logger.LogError(ex, "Failed to schedule coordinator workflow for booking {BookingId}", bookingId);
        }
    }

    private async Task MarkBookingNeedsManualReviewAsync(Guid bookingId)
    {
        try
        {
            using var recoveryScope = _scopeFactory.CreateScope();
            var freshDb = recoveryScope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var booking = await freshDb.Bookings.FindAsync(bookingId);
            if (booking is not null && booking.Status != BookingStatus.NeedsManualReview)
            {
                booking.Status = BookingStatus.NeedsManualReview;
                await freshDb.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to mark booking {BookingId} as NeedsManualReview after workflow failure", bookingId);
        }
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

    [HttpPatch("{id:guid}/guide-notes")]
    [Authorize(Roles = "TourGuide")]
    public async Task<ActionResult<AssignedTourDto>> UpdateGuideNotes(
        Guid id,
        UpdateGuideTourRequest request,
        CancellationToken ct)
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
            return Forbid();
        }

        var booking = await _db.Bookings
            .Include(b => b.TourPackage)
                .ThenInclude(p => p.Locations)
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (booking is null)
        {
            return NotFound();
        }

        var isAssigned = await _db.GuideAvailabilities
            .AnyAsync(a => a.GuideId == guide.Id && a.AssignedBookingId == id, ct);

        if (!isAssigned)
        {
            return Forbid();
        }

        if (request.Notes?.Length > 2000)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("notes", "Guide notes cannot exceed 2000 characters.") }
            });
        }

        booking.Attended = request.Attended;
        booking.Completed = request.Completed;
        booking.GuideNotes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("TourGuide {GuideId} updated booking {BookingId}: Attended={Attended}, Completed={Completed}",
            guide.Id, booking.Id, booking.Attended, booking.Completed);

        return Ok(AssignedTourDto.FromEntity(booking, guide));
    }

    [HttpGet("{id:guid}/itinerary")]
    public async Task<ActionResult<IReadOnlyList<ItineraryStepDto>>> GetItinerary(Guid id, CancellationToken ct)
    {
        var currentUserId = GetUserId();
        if (currentUserId is null)
        {
            return Unauthorized();
        }

        var booking = await _db.Bookings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (booking is null)
        {
            return NotFound();
        }

        var isManager = User.IsInRole("OperationsManager") || User.IsInRole("Admin");
        var isOwner = booking.TravelerId == currentUserId.Value;

        var isAssignedGuide = false;
        if (!isManager && !isOwner && User.IsInRole("TourGuide"))
        {
            var guide = await _db.Guides
                .AsNoTracking()
                .FirstOrDefaultAsync(g => g.UserId == currentUserId.Value, ct);

            if (guide is not null)
            {
                isAssignedGuide = await _db.GuideAvailabilities
                    .AnyAsync(a => a.GuideId == guide.Id && a.AssignedBookingId == id, ct);
            }
        }

        if (!isManager && !isOwner && !isAssignedGuide)
        {
            return Forbid();
        }

        var steps = await _itineraryService.GetItineraryAsync(id, ct);
        return Ok(steps.Select(ItineraryStepDto.FromEntity).ToList());
    }

    [HttpPost("{id:guid}/itinerary")]
    [Authorize(Roles = "OperationsManager,TourGuide,Admin")]
    public async Task<ActionResult<IReadOnlyList<ItineraryStepDto>>> SetItinerary(
        Guid id,
        SetItineraryRequest request,
        CancellationToken ct)
    {
        var currentUserId = GetUserId();
        if (currentUserId is null)
        {
            return Unauthorized();
        }

        var booking = await _db.Bookings
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (booking is null)
        {
            return NotFound();
        }

        if (booking.Status != BookingStatus.Confirmed)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("status", "Itineraries can only be created for confirmed bookings.") }
            });
        }

        var isManager = User.IsInRole("OperationsManager") || User.IsInRole("Admin");
        if (!isManager)
        {
            if (User.IsInRole("TourGuide"))
            {
                var guide = await _db.Guides
                    .AsNoTracking()
                    .FirstOrDefaultAsync(g => g.UserId == currentUserId.Value, ct);

                if (guide is null)
                {
                    return Forbid();
                }

                var isAssigned = await _db.GuideAvailabilities
                    .AnyAsync(a => a.GuideId == guide.Id && a.AssignedBookingId == id, ct);

                if (!isAssigned)
                {
                    return Forbid();
                }
            }
            else
            {
                return Forbid();
            }
        }

        if (request?.Steps is null)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("steps", "Steps list cannot be null.") }
            });
        }

        var errors = new List<FieldValidationError>();

        for (var i = 0; i < request.Steps.Count; i++)
        {
            var step = request.Steps[i];
            if (step.DayNumber <= 0)
            {
                errors.Add(new FieldValidationError($"steps[{i}].dayNumber", "Day number must be greater than 0."));
            }

            if (string.IsNullOrWhiteSpace(step.Activity))
            {
                errors.Add(new FieldValidationError($"steps[{i}].activity", "Activity is required."));
            }
            else if (step.Activity.Trim().Length > 300)
            {
                errors.Add(new FieldValidationError($"steps[{i}].activity", "Activity cannot exceed 300 characters."));
            }

            if (string.IsNullOrWhiteSpace(step.Location))
            {
                errors.Add(new FieldValidationError($"steps[{i}].location", "Location is required."));
            }
            else if (step.Location.Trim().Length > 300)
            {
                errors.Add(new FieldValidationError($"steps[{i}].location", "Location cannot exceed 300 characters."));
            }
        }

        var duplicateSchedule = request.Steps
            .GroupBy(s => (s.DayNumber, s.StartTime))
            .FirstOrDefault(g => g.Count() > 1);

        if (duplicateSchedule is not null)
        {
            errors.Add(new FieldValidationError("steps", $"Duplicate step scheduled for Day {duplicateSchedule.Key.DayNumber} at {duplicateSchedule.Key.StartTime}."));
        }

        if (errors.Count > 0)
        {
            return BadRequest(new { errors });
        }

        var newSteps = request.Steps.Select(s => new ItineraryStep
        {
            DayNumber = s.DayNumber,
            Activity = s.Activity.Trim(),
            Location = s.Location.Trim(),
            StartTime = s.StartTime
        });

        var savedSteps = await _itineraryService.SetItineraryAsync(id, newSteps, ct);

        _logger.LogInformation("Itinerary updated for booking {BookingId} with {Count} steps", id, savedSteps.Count);

        return Ok(savedSteps.Select(ItineraryStepDto.FromEntity).ToList());
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

        if (request.SpecialRequests?.Length > MaxSpecialRequestsLength)
        {
            errors.Add(new FieldValidationError(
                "specialRequests",
                $"Special requests cannot exceed {MaxSpecialRequestsLength} characters."));
        }

        return errors;
    }

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }
}
