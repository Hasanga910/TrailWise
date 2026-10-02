using System.Security.Claims;
using System.Text.Json;
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
    private const string ManagerRoles = "OperationsManager,FleetCoordinator,Admin";
    private const int MaxAdvanceBookingDays = 365;
    private const int DefaultPageSize = 10;
    private const int MaxPageSize = 50;
    private const int MaxSpecialRequestsLength = 1000;
    private const int MaxLanguagePreferenceLength = 100;

    private readonly TrailWiseDbContext _db;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IItineraryService _itineraryService;
    private readonly IAuditLogService _auditLogService;
    private readonly IFleetReservationService _fleetReservationService;
    private readonly IFleetCapacityAgent _fleetAgent;
    private readonly IGuideAssignmentService _guideAssignmentService;
    private readonly IGuideAvailabilityService _guideAvailabilityService;
    private readonly IGuideMatchingAgent? _guideMatchingAgent;
    private readonly IBookingNotificationService? _bookingNotificationService;
    private readonly ILogger<BookingsController> _logger;
    private readonly IPaymentService _paymentService;
    private readonly IClock _clock;
    private readonly IBookingLifecycleService _bookingLifecycleService;

    public BookingsController(
        TrailWiseDbContext db,
        IServiceScopeFactory scopeFactory,
        IItineraryService itineraryService,
        IAuditLogService auditLogService,
        IFleetReservationService fleetReservationService,
        IFleetCapacityAgent fleetAgent,
        IGuideAssignmentService guideAssignmentService,
        IGuideAvailabilityService guideAvailabilityService,
        ILogger<BookingsController> logger,
        IPaymentService paymentService,
        IClock? clock = null,
        IBookingLifecycleService? bookingLifecycleService = null,
        IBookingNotificationService? bookingNotificationService = null,
        IGuideMatchingAgent? guideMatchingAgent = null)
    {
        _db = db;
        _scopeFactory = scopeFactory;
        _itineraryService = itineraryService;
        _auditLogService = auditLogService;
        _fleetReservationService = fleetReservationService;
        _fleetAgent = fleetAgent;
        _guideAssignmentService = guideAssignmentService;
        _guideAvailabilityService = guideAvailabilityService;
        _guideMatchingAgent = guideMatchingAgent;
        _logger = logger;
        _paymentService = paymentService;
        _clock = clock ?? new SystemClock();
        _bookingLifecycleService = bookingLifecycleService ?? new BookingLifecycleService(_clock);
        _bookingNotificationService = bookingNotificationService;
    }

    [HttpPost]
    [Authorize(Roles = "Traveler")]
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
            LanguagePreference = string.IsNullOrWhiteSpace(request.LanguagePreference) ? null : request.LanguagePreference.Trim(),
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

    [HttpGet]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<IReadOnlyList<BookingSummaryDto>>> GetAll(CancellationToken ct)
    {
        var bookings = await _db.Bookings
            .Include(b => b.Traveler)
            .Include(b => b.TourPackage)
            .OrderByDescending(b => b.CreatedAt)
            .AsNoTracking()
            .ToListAsync(ct);

        return Ok(bookings.Select(BookingSummaryDto.FromEntity).ToList());
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

    [HttpGet("paged")]
    [Authorize(Roles = "Admin,OperationsManager,FleetCoordinator")]
    public async Task<ActionResult<PagedResult<BookingDto>>> GetAll(
        BookingStatus? status,
        DateOnly? from,
        DateOnly? to,
        int page = 1,
        int pageSize = DefaultPageSize,
        CancellationToken ct = default)
    {
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
            .Include(b => b.GuideAvailabilities)
                .ThenInclude(ga => ga.Guide)
            .AsNoTracking();

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
            .ToListAsync(ct);

        return Ok(new PagedResult<BookingDto>(
            bookings.Select(b => BookingDto.FromEntity(b)).ToList(),
            totalCount,
            page,
            pageSize));
    }

    [HttpGet("mine")]
    public async Task<ActionResult<PagedResult<BookingDto>>> GetMine(
        string? status,
        DateOnly? from,
        DateOnly? to,
        string? sortBy = "createdAt",
        string? sortDirection = "desc",
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
            .Include(b => b.GuideAvailabilities)
                .ThenInclude(ga => ga.Guide)
            .Include(b => b.Reviews)
            .Where(b => b.TravelerId == travelerId.Value);

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (string.Equals(status, "Pending", StringComparison.OrdinalIgnoreCase))
            {
                var pendingStatuses = new[]
                {
                    BookingStatus.Requested,
                    BookingStatus.PlanProposed,
                    BookingStatus.PendingApproval,
                    BookingStatus.NeedsManualReview
                };
                query = query.Where(b => pendingStatuses.Contains(b.Status));
            }
            else if (Enum.TryParse<BookingStatus>(status, true, out var parsedStatus))
            {
                query = query.Where(b => b.Status == parsedStatus);
            }
            else
            {
                return BadRequest(new
                {
                    errors = new[] { new FieldValidationError("status", $"'{status}' is not a valid booking status.") }
                });
            }
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

        var normalizedSortBy = (sortBy ?? "createdAt").Trim().ToLowerInvariant();
        var normalizedSortDirection = (sortDirection ?? "desc").Trim().ToLowerInvariant();
        var isAscending = normalizedSortDirection == "asc";

        IOrderedQueryable<Booking> orderedQuery = normalizedSortBy switch
        {
            "startdate" => isAscending
                ? query.OrderBy(b => b.StartDate).ThenBy(b => b.CreatedAt).ThenBy(b => b.Id)
                : query.OrderByDescending(b => b.StartDate).ThenByDescending(b => b.CreatedAt).ThenByDescending(b => b.Id),
            "status" => isAscending
                ? query.OrderBy(b => b.Status).ThenByDescending(b => b.CreatedAt).ThenBy(b => b.Id)
                : query.OrderByDescending(b => b.Status).ThenByDescending(b => b.CreatedAt).ThenByDescending(b => b.Id),
            _ => isAscending
                ? query.OrderBy(b => b.CreatedAt).ThenBy(b => b.Id)
                : query.OrderByDescending(b => b.CreatedAt).ThenByDescending(b => b.Id)
        };

        var bookings = await orderedQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        var statusMap = await _paymentService.GetPaymentStatusesForBookingsAsync(
            bookings.Select(b => b.Id),
            travelerId.Value,
            isManagerOrAdmin: false,
            ct);

        var dtos = bookings.Select(b =>
        {
            statusMap.TryGetValue(b.Id, out var ps);
            return BookingDto.FromEntity(
                b,
                paymentStatus: ps?.Succeeded == true ? ps.Status : null,
                remainingAmount: ps?.Succeeded == true ? ps.RemainingAmount : null,
                isFullyPaid: ps?.Succeeded == true && ps.Status == "FullyPaid",
                hasPendingPayment: ps?.Succeeded == true && ps.HasPendingVerification);
        }).ToList();

        return Ok(new PagedResult<BookingDto>(
            dtos,
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
            .Include(b => b.GuideAvailabilities)
                .ThenInclude(ga => ga.Guide)
            .Include(b => b.Reviews)
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (booking is null)
        {
            return NotFound();
        }

        var travelerId = GetUserId();
        var isOwner = travelerId.HasValue && booking.TravelerId == travelerId.Value;
        var isManager = User.IsInRole("Admin") || User.IsInRole("OperationsManager") || User.IsInRole("FleetCoordinator");

        if (!isOwner && !isManager)
        {
            return Forbid();
        }

        PaymentStatusResult? paymentStatus = null;
        if (travelerId.HasValue)
        {
            paymentStatus = await _paymentService.GetPaymentStatusAsync(booking.Id, travelerId.Value, isManager, ct);
        }

        var dto = BookingDto.FromEntity(
            booking,
            paymentStatus: paymentStatus?.Succeeded == true ? paymentStatus.Status : null,
            remainingAmount: paymentStatus?.Succeeded == true ? paymentStatus.RemainingAmount : null,
            isFullyPaid: paymentStatus?.Succeeded == true && paymentStatus.Status == "FullyPaid",
            hasPendingPayment: paymentStatus?.Succeeded == true && paymentStatus.HasPendingVerification);

        return Ok(dto);
    }

    [HttpPatch("{id:guid}/decision")]
    [HttpPost("{id:guid}/decide")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<BookingDto>> Decide(Guid id, BookingDecisionRequest request, CancellationToken ct)
    {
        var booking = await _db.Bookings
            .Include(b => b.TourPackage)
            .Include(b => b.PackageTier)
            .Include(b => b.GuideAvailabilities)
                .ThenInclude(ga => ga.Guide)
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (booking is null)
        {
            return NotFound();
        }

        if (!BookingStatusTransitions.CanDecide(booking.Status))
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: $"This booking is already {booking.Status} and cannot be decided again.");
        }

        var performedBy = GetUserId();
        if (performedBy is null)
        {
            return Unauthorized();
        }

        if (request.Decision != BookingDecision.Approve)
        {
            booking.Status = BookingStatus.Cancelled;
        }

        var run = await _db.AgentWorkflowRuns
            .Where(r => r.BookingId == booking.Id)
            .OrderByDescending(r => r.StartedAt)
            .FirstOrDefaultAsync(ct);

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            if (run is not null)
            {
                // "Completed" here means the workflow run itself is finished, not that the
                // booking was approved — both an approve and a reject conclude the run, they
                // just leave the booking in different final statuses.
                run.Status = "Completed";
                run.CompletedAt = DateTimeOffset.UtcNow;

                _db.AgentStepLogs.Add(new AgentStepLog
                {
                    WorkflowRunId = run.Id,
                    AgentName = "manager_decision",
                    InputJson = JsonSerializer.Serialize(
                        new { decision = request.Decision.ToString(), request.Notes },
                        AgentJsonOptions.Default),
                    OutputJson = JsonSerializer.Serialize(
                        new { newStatus = booking.Status.ToString() },
                        AgentJsonOptions.Default),
                    DurationMs = 0,
                });
            }

            // Option 1: Auto-assign AI-matched vehicle and driver on approval if not already assigned
            if (request.Decision == BookingDecision.Approve)
            {
                var alreadyAssigned = await _db.VehicleAssignments.AnyAsync(a => a.BookingId == booking.Id, ct);
                if (!alreadyAssigned)
                {
                    Guid vehicleId = Guid.Empty;
                    Guid driverId = Guid.Empty;

                    if (run is not null)
                    {
                        var vehicleStepLog = await _db.AgentStepLogs
                            .Where(s => s.WorkflowRunId == run.Id && s.AgentName == "FleetCapacityAgent")
                            .OrderByDescending(s => s.CreatedAt)
                            .FirstOrDefaultAsync(ct);

                        if (vehicleStepLog != null && !string.IsNullOrWhiteSpace(vehicleStepLog.OutputJson))
                        {
                            try
                            {
                                using var doc = JsonDocument.Parse(vehicleStepLog.OutputJson);
                                if (doc.RootElement.TryGetProperty("vehicleId", out var vProp) && vProp.TryGetGuid(out var vGuid))
                                    vehicleId = vGuid;
                                if (doc.RootElement.TryGetProperty("driverId", out var dProp) && dProp.TryGetGuid(out var dGuid))
                                    driverId = dGuid;
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Failed to parse vehicleStepLog OutputJson for booking {BookingId}", booking.Id);
                            }
                        }
                    }

                    // Check if proposed vehicle and driver are still available
                    bool isVehAvail = vehicleId != Guid.Empty && await _fleetReservationService.IsVehicleAvailableAsync(vehicleId, booking.StartDate, booking.EndDate, ct);
                    bool isDrvAvail = driverId != Guid.Empty && await _fleetReservationService.IsDriverAvailableAsync(driverId, booking.StartDate, booking.EndDate, ct);

                    // If neither was proposed or if either has been taken by an earlier approval, dynamically re-match against the currently available fleet
                    if (!isVehAvail || !isDrvAvail)
                    {
                        if (vehicleId != Guid.Empty || driverId != Guid.Empty)
                        {
                            _logger.LogInformation("Originally proposed vehicle {VehicleId} or driver {DriverId} is no longer available for booking {BookingId}. Performing dynamic real-time re-match.",
                                vehicleId, driverId, booking.Id);
                        }

                        var rematch = await _fleetAgent.MatchAsync(booking.Id, ct);
                        if (!rematch.ConflictCheck && rematch.VehicleId != Guid.Empty && rematch.DriverId != Guid.Empty)
                        {
                            vehicleId = rematch.VehicleId;
                            driverId = rematch.DriverId;
                            isVehAvail = await _fleetReservationService.IsVehicleAvailableAsync(vehicleId, booking.StartDate, booking.EndDate, ct);
                            isDrvAvail = await _fleetReservationService.IsDriverAvailableAsync(driverId, booking.StartDate, booking.EndDate, ct);
                        }
                    }

                    if (isVehAvail && isDrvAvail)
                    {
                        var newAssignment = new VehicleAssignment
                        {
                            VehicleId = vehicleId,
                            DriverId = driverId,
                            BookingId = booking.Id,
                            StartDate = booking.StartDate,
                            EndDate = booking.EndDate
                        };
                        _db.VehicleAssignments.Add(newAssignment);
                        _logger.LogInformation("Auto-assigned vehicle {VehicleId} and driver {DriverId} to approved booking {BookingId}",
                            vehicleId, driverId, booking.Id);
                    }
                    else
                    {
                        _logger.LogWarning("No suitable available vehicle or driver could be assigned to booking {BookingId} upon approval",
                            booking.Id);
                    }
                }

                // Auto-assign Guide if not already assigned
                var alreadyHasGuide = await _db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == booking.Id, ct);
                if (!alreadyHasGuide)
                {
                    Guid guideId = request.GuideId ?? Guid.Empty;

                    if (guideId == Guid.Empty && run is not null)
                    {
                        var guideStepLog = await _db.AgentStepLogs
                            .Where(s => s.WorkflowRunId == run.Id && s.AgentName == "GuideMatchingAgent")
                            .OrderByDescending(s => s.CreatedAt)
                            .FirstOrDefaultAsync(ct);

                        if (guideStepLog != null && !string.IsNullOrWhiteSpace(guideStepLog.OutputJson))
                        {
                            try
                            {
                                using var gDoc = JsonDocument.Parse(guideStepLog.OutputJson);
                                if (gDoc.RootElement.TryGetProperty("guideId", out var gProp) && gProp.TryGetGuid(out var gGuid))
                                    guideId = gGuid;
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Failed to parse guideStepLog OutputJson for booking {BookingId}", booking.Id);
                            }
                        }
                    }

                    // Check guide availability or re-match if necessary
                    bool isGuideAvail = guideId != Guid.Empty && await _guideAvailabilityService.IsGuideAvailableAsync(guideId, booking.StartDate, booking.EndDate, ct);

                    if (!isGuideAvail && _guideMatchingAgent != null)
                    {
                        var rematchGuide = await _guideMatchingAgent.MatchAsync(booking.Id, ct);
                        if (rematchGuide.GuideId != Guid.Empty)
                        {
                            guideId = rematchGuide.GuideId;
                            isGuideAvail = await _guideAvailabilityService.IsGuideAvailableAsync(guideId, booking.StartDate, booking.EndDate, ct);
                        }
                    }

                    // Fallback to any available guide in the system for these dates if still not matched
                    if (!isGuideAvail || guideId == Guid.Empty)
                    {
                        var allGuides = await _db.Guides.Select(g => g.Id).ToListAsync(ct);
                        foreach (var gId in allGuides)
                        {
                            if (await _guideAvailabilityService.IsGuideAvailableAsync(gId, booking.StartDate, booking.EndDate, ct))
                            {
                                guideId = gId;
                                isGuideAvail = true;
                                break;
                            }
                        }
                    }

                    if (isGuideAvail && guideId != Guid.Empty)
                    {
                        await _guideAssignmentService.AssignGuideAsync(booking.Id, guideId, ct);
                        _logger.LogInformation("Auto-assigned tour guide {GuideId} to approved booking {BookingId}", guideId, booking.Id);
                    }
                    else
                    {
                        _logger.LogWarning("No available tour guide could be auto-assigned to booking {BookingId} upon approval", booking.Id);
                    }
                }

                // Strictly verify all 3 resources before transitioning to Confirmed:
                var hasAssignedGuide = _db.GuideAvailabilities.Local.Any(a => a.AssignedBookingId == booking.Id && a.GuideId != Guid.Empty) ||
                    await _db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == booking.Id && a.GuideId != Guid.Empty, ct);
                var hasVehicleAndDriver = _db.VehicleAssignments.Local.Any(a => a.BookingId == booking.Id && a.VehicleId != Guid.Empty && a.DriverId != Guid.Empty) ||
                    await _db.VehicleAssignments.AnyAsync(a => a.BookingId == booking.Id && a.VehicleId != Guid.Empty && a.DriverId != Guid.Empty, ct);

                if (hasAssignedGuide && hasVehicleAndDriver)
                {
                    _bookingLifecycleService.TransitionToConfirmed(booking);
                }
                else
                {
                    var missingResources = new List<string>();
                    if (!hasVehicleAndDriver) missingResources.Add("Vehicle & Driver");
                    if (!hasAssignedGuide) missingResources.Add("Tour Guide");

                    var message = $"A booking cannot be confirmed until all resources are allocated. Missing: {string.Join(", ", missingResources)}.";
                    _logger.LogWarning("Decide conflict on booking {BookingId}: {Message}. hasAssignedGuide={HasGuide}, hasVehicleAndDriver={HasVehicleAndDriver}",
                        booking.Id, message, hasAssignedGuide, hasVehicleAndDriver);
                    if (transaction is not null)
                    {
                        await transaction.RollbackAsync(ct);
                    }
                    return Problem(
                        statusCode: StatusCodes.Status409Conflict,
                        title: message,
                        detail: message);
                }
            }

            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Booking",
                entityId: booking.Id,
                action: request.Decision == BookingDecision.Approve ? "BookingApproved" : "BookingRejected",
                performedBy: performedBy.Value,
                details: new { decision = request.Decision.ToString(), request.Notes },
                ct: ct);

            if (transaction is not null)
            {
                await transaction.CommitAsync(ct);
            }

            if (request.Decision == BookingDecision.Approve)
            {
                var bookingId = booking.Id;
                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var scope = _scopeFactory.CreateScope();
                        var notificationService = scope.ServiceProvider.GetRequiredService<IBookingNotificationService>();
                        await notificationService.SendBookingConfirmedNotificationsAsync(bookingId, CancellationToken.None);
                    }
                    catch (Exception notifEx)
                    {
                        _logger.LogError(notifEx, "Failed to dispatch confirmation SMS notifications for Booking {BookingId}", bookingId);
                    }
                });
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

        return Ok(BookingDto.FromEntity(booking));
    }

    [HttpPatch("{id:guid}/complete")]
    [HttpPost("{id:guid}/complete")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<BookingDto>> Complete(Guid id, CancellationToken ct)
    {
        var booking = await _db.Bookings
            .Include(b => b.TourPackage)
            .Include(b => b.PackageTier)
            .Include(b => b.GuideAvailabilities)
                .ThenInclude(ga => ga.Guide)
            .Include(b => b.Reviews)
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (booking is null)
        {
            return NotFound();
        }

        if (booking.Status == BookingStatus.Completed)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Booking is already completed.");
        }

        if (!BookingStatusTransitions.CanComplete(booking.Status))
        {
            // POST is the legacy contract (400 for an invalid transition); PATCH reports a 409 conflict.
            if (HttpMethods.IsPost(Request.Method))
            {
                return BadRequest(new
                {
                    message = "Only confirmed bookings can be marked as completed."
                });
            }

            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: $"This booking is {booking.Status} and cannot be marked completed.");
        }

        var performedBy = GetUserId();
        if (performedBy is null)
        {
            return Unauthorized();
        }

        booking.Status = BookingStatus.Completed;

        PaymentStatusResult? paymentStatus = null;
        if (booking.TravelerId != Guid.Empty)
        {
            paymentStatus = await _paymentService.GetPaymentStatusAsync(booking.Id, booking.TravelerId, isManagerOrAdmin: true, ct);
        }

        var balanceDeadlineSet = false;
        if (paymentStatus?.Succeeded == true && paymentStatus.RemainingAmount > 0)
        {
            if (!booking.BalancePaymentDueAt.HasValue)
            {
                booking.BalancePaymentDueAt = _clock.UtcNow.AddHours(24);
                balanceDeadlineSet = true;
            }
        }

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Booking",
                entityId: booking.Id,
                action: "BookingCompleted",
                performedBy: performedBy.Value,
                details: new
                {
                    travelerId = booking.TravelerId,
                    tourPackageId = booking.TourPackageId,
                    startDate = booking.StartDate.ToString("yyyy-MM-dd"),
                    endDate = booking.EndDate.ToString("yyyy-MM-dd"),
                    previousStatus = "Confirmed",
                    newStatus = "Completed",
                    completedAt = _clock.UtcNow
                },
                ct: ct);

            if (balanceDeadlineSet && booking.BalancePaymentDueAt.HasValue)
            {
                await _auditLogService.LogAsync(
                    entityType: "Booking",
                    entityId: booking.Id,
                    action: "BalancePaymentDeadlineSet",
                    performedBy: performedBy.Value,
                    details: new
                    {
                        bookingId = booking.Id,
                        balancePaymentDueAt = booking.BalancePaymentDueAt.Value
                    },
                    ct: ct);
            }

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

        return Ok(BookingDto.FromEntity(
            booking,
            paymentStatus: paymentStatus?.Succeeded == true ? paymentStatus.Status : null,
            remainingAmount: paymentStatus?.Succeeded == true ? paymentStatus.RemainingAmount : null,
            isFullyPaid: paymentStatus?.Succeeded == true && paymentStatus.Status == "FullyPaid",
            hasPendingPayment: paymentStatus?.Succeeded == true && paymentStatus.HasPendingVerification));
    }

    [HttpPatch("{id:guid}/cancel")]
    public async Task<ActionResult<BookingDto>> Cancel(Guid id, CancelBookingRequest request, CancellationToken ct)
    {
        var booking = await _db.Bookings
            .Include(b => b.TourPackage)
            .Include(b => b.PackageTier)
            .Include(b => b.GuideAvailabilities)
                .ThenInclude(ga => ga.Guide)
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (booking is null)
        {
            return NotFound();
        }

        var callerId = GetUserId();
        var isOwner = callerId.HasValue && booking.TravelerId == callerId.Value;
        var isManager = User.IsInRole("Admin") || User.IsInRole("OperationsManager") || User.IsInRole("FleetCoordinator");

        if (!isOwner && !isManager)
        {
            return Forbid();
        }

        if (!BookingStatusTransitions.CanCancel(booking.Status))
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: $"This booking is {booking.Status} and cannot be cancelled.");
        }

        if (!isManager && booking.StartDate <= DateOnly.FromDateTime(DateTime.UtcNow))
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "This booking has already started or finished and cannot be self-cancelled.");
        }

        booking.Status = BookingStatus.Cancelled;

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            var assignments = await _db.VehicleAssignments
                .Where(a => a.BookingId == booking.Id)
                .ToListAsync(ct);

            if (assignments.Count > 0)
            {
                _db.VehicleAssignments.RemoveRange(assignments);
                _logger.LogInformation("Released {Count} vehicle assignments for cancelled booking {BookingId}.", assignments.Count, booking.Id);
            }

            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Booking",
                entityId: booking.Id,
                action: isManager ? "BookingCancelledByStaff" : "BookingCancelledByTraveler",
                performedBy: callerId,
                details: new { request.Reason, ReleasedVehicleAssignments = assignments.Count },
                ct: ct);

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

        return Ok(BookingDto.FromEntity(booking));
    }

    [HttpPost("{id:guid}/assign-guide")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<AssignGuideResponse>> AssignGuide(
        Guid id,
        AssignGuideRequest request,
        CancellationToken ct)
    {
        if (request is null || request.GuideId == Guid.Empty)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("guideId", "GuideId is required.") }
            });
        }

        var booking = await _db.Bookings
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (booking is null)
        {
            return NotFound();
        }

        var guideExists = await _db.Guides
            .AsNoTracking()
            .AnyAsync(g => g.Id == request.GuideId, ct);

        if (!guideExists)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Guide not found.");
        }

        if (booking.Status != BookingStatus.NeedsManualReview)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("status", $"Only bookings in NeedsManualReview status can be assigned a guide. Current status is {booking.Status}.") }
            });
        }

        var assigned = await _guideAssignmentService.AssignGuideAsync(id, request.GuideId, ct);
        if (!assigned)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Selected guide is no longer available for this booking.");
        }

        var hasVehicleAndDriver = await _db.VehicleAssignments
            .AnyAsync(a => a.BookingId == booking.Id && a.VehicleId != Guid.Empty && a.DriverId != Guid.Empty, ct);

        bool transitionedToConfirmed = false;
        if (hasVehicleAndDriver)
        {
            transitionedToConfirmed = _bookingLifecycleService.TransitionToConfirmed(booking);
        }
        await _db.SaveChangesAsync(ct);

        var performedBy = GetUserId();
        await _auditLogService.LogAsync(
            entityType: "Booking",
            entityId: booking.Id,
            action: "Guide manually assigned by Operations Manager",
            performedBy: performedBy,
            details: new { guideId = request.GuideId },
            ct: ct);

        _logger.LogInformation("Guide {GuideId} manually assigned to booking {BookingId} by user {UserId}",
            request.GuideId, booking.Id, performedBy);

        var assignedBookingId = booking.Id;
        if (transitionedToConfirmed)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var notificationService = scope.ServiceProvider.GetRequiredService<IBookingNotificationService>();
                    await notificationService.SendBookingConfirmedNotificationsAsync(assignedBookingId, CancellationToken.None);
                }
                catch (Exception notifEx)
                {
                    _logger.LogError(notifEx, "Failed to dispatch confirmation SMS notifications for Booking {BookingId}", assignedBookingId);
                }
            });
        }

        return Ok(new AssignGuideResponse(booking.Id, request.GuideId, booking.Status));
    }

    [HttpGet("{id:guid}/available-guides")]
    [Authorize(Roles = ManagerRoles)]
    public async Task<ActionResult<IReadOnlyList<AvailableGuideDto>>> GetAvailableGuides(
        Guid id,
        CancellationToken ct)
    {
        var booking = await _db.Bookings
            .Include(b => b.TourPackage)
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (booking is null)
        {
            return NotFound();
        }

        var allGuides = await _db.Guides
            .AsNoTracking()
            .OrderBy(g => g.Name)
            .ToListAsync(ct);

        var theme = booking.TourPackage?.Theme?.Trim();
        var langPref = string.IsNullOrWhiteSpace(booking.LanguagePreference) ? null : booking.LanguagePreference.Trim();

        var availableGuides = new List<AvailableGuideDto>();

        foreach (var guide in allGuides)
        {
            var isAvailable = await _guideAvailabilityService.IsGuideAvailableAsync(
                guide.Id,
                booking.StartDate,
                booking.EndDate,
                ct);

            if (!isAvailable)
            {
                continue;
            }

            var matchesSpec = !string.IsNullOrWhiteSpace(theme) &&
                guide.Specializations.Any(s => string.Equals(s?.Trim(), theme, StringComparison.OrdinalIgnoreCase));

            var matchesLang = langPref != null &&
                guide.Languages.Any(l => string.Equals(l?.Trim(), langPref, StringComparison.OrdinalIgnoreCase));

            var notesList = new List<string>();
            if (matchesSpec) notesList.Add($"Matches package theme: {theme}");
            if (matchesLang) notesList.Add($"Matches language preference: {langPref}");
            if (!matchesSpec && !string.IsNullOrWhiteSpace(theme)) notesList.Add("Different specialization");

            availableGuides.Add(new AvailableGuideDto(
                guide.Id,
                guide.Name,
                guide.Languages,
                guide.Specializations,
                guide.ContactInfo,
                matchesSpec,
                matchesLang,
                notesList.Count > 0 ? string.Join(", ", notesList) : null));
        }

        var sorted = availableGuides
            .OrderByDescending(g => (g.MatchesSpecialization ? 2 : 0) + (g.MatchesLanguage ? 1 : 0))
            .ThenBy(g => g.Name)
            .ToList();

        return Ok(sorted);
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
        // Completed is strictly lifecycle-controlled by EndTour and cannot be manually modified
        booking.Completed = booking.TourEndedAt.HasValue;
        booking.GuideNotes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("TourGuide {GuideId} updated booking {BookingId}: Attended={Attended}, Completed={Completed}",
            guide.Id, booking.Id, booking.Attended, booking.Completed);

        return Ok(AssignedTourDto.FromEntity(booking, guide));
    }

    [HttpPost("{id:guid}/start-tour")]
    [Authorize(Roles = "TourGuide")]
    public async Task<ActionResult<AssignedTourDto>> StartTour(Guid id, CancellationToken ct)
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

        if (booking.Status != BookingStatus.Confirmed)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("status", "Only confirmed tours can be started.") }
            });
        }

        if (booking.TourStartedAt.HasValue)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("tourStartedAt", "Tour has already been started.") }
            });
        }

        if (booking.TourEndedAt.HasValue)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("tourEndedAt", "Tour has already been ended.") }
            });
        }

        booking.TourStartedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("TourGuide {GuideId} started tour for booking {BookingId} at {StartedAt}",
            guide.Id, booking.Id, booking.TourStartedAt);

        return Ok(AssignedTourDto.FromEntity(booking, guide));
    }

    [HttpPost("{id:guid}/end-tour")]
    [Authorize(Roles = "TourGuide")]
    public async Task<ActionResult<AssignedTourDto>> EndTour(Guid id, CancellationToken ct)
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

        if (!booking.TourStartedAt.HasValue)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("tourStartedAt", "Tour cannot be ended before it has been started.") }
            });
        }

        if (booking.TourEndedAt.HasValue)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("tourEndedAt", "Tour has already been ended.") }
            });
        }

        booking.TourEndedAt = DateTimeOffset.UtcNow;
        booking.Completed = true;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("TourGuide {GuideId} ended tour for booking {BookingId} at {EndedAt}",
            guide.Id, booking.Id, booking.TourEndedAt);

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

        if (request.LanguagePreference?.Length > MaxLanguagePreferenceLength)
        {
            errors.Add(new FieldValidationError(
                "languagePreference",
                $"Language preference cannot exceed {MaxLanguagePreferenceLength} characters."));
        }

        return errors;
    }

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }
}
