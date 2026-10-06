using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Fleet;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/vehicles")]
public class VehiclesController : ControllerBase
{
    private const string FleetCoordinatorOrAdmin = "FleetCoordinator,Admin";

    private readonly TrailWiseDbContext _db;
    private readonly IFleetReservationService _fleetReservationService;
    private readonly ILogger<VehiclesController> _logger;

    public VehiclesController(
        TrailWiseDbContext db,
        IFleetReservationService fleetReservationService,
        ILogger<VehiclesController> logger)
    {
        _db = db;
        _fleetReservationService = fleetReservationService;
        _logger = logger;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<VehicleDto>>> GetAll(
        [FromQuery] bool? hasAC,
        [FromQuery] int? minCapacity,
        [FromQuery] VehicleType? type,
        [FromQuery] VehicleMaintenanceStatus? status,
        CancellationToken ct)
    {
        var query = _db.Vehicles.AsNoTracking();

        if (hasAC.HasValue)
        {
            query = query.Where(v => v.HasAC == hasAC.Value);
        }

        if (minCapacity.HasValue)
        {
            query = query.Where(v => v.Capacity >= minCapacity.Value);
        }

        if (type.HasValue)
        {
            query = query.Where(v => v.Type == type.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(v => v.MaintenanceStatus == status.Value);
        }

        var vehicles = await query
            .OrderBy(v => v.Type)
            .ThenBy(v => v.Capacity)
            .ToListAsync(ct);

        return Ok(vehicles.Select(VehicleDto.FromEntity).ToList());
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<VehicleDto>> GetById(Guid id, CancellationToken ct)
    {
        var vehicle = await _db.Vehicles
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == id, ct);

        if (vehicle is null)
        {
            return NotFound();
        }

        return Ok(VehicleDto.FromEntity(vehicle));
    }

    [HttpPost]
    [Authorize(Roles = FleetCoordinatorOrAdmin)]
    public async Task<ActionResult<VehicleDto>> Create(CreateVehicleRequest request, CancellationToken ct)
    {
        if (request.Capacity < 1)
        {
            return BadRequest(new { errors = new[] { "Capacity must be at least 1." } });
        }

        var normalizedRegistrationNumber = request.RegistrationNumber.Trim().ToUpperInvariant();

        var registrationExists = await _db.Vehicles.AnyAsync(
            v => v.RegistrationNumber == normalizedRegistrationNumber, ct);
        if (registrationExists)
        {
            return Conflict(new { errors = new[] { $"A vehicle with registration number '{normalizedRegistrationNumber}' already exists." } });
        }

        var vehicle = new Vehicle
        {
            Type = request.Type,
            RegistrationNumber = normalizedRegistrationNumber,
            Capacity = request.Capacity,
            HasAC = request.HasAC,
            SeatConfiguration = string.IsNullOrWhiteSpace(request.SeatConfiguration) ? string.Empty : request.SeatConfiguration.Trim(),
            MaintenanceStatus = request.MaintenanceStatus
        };

        _db.Vehicles.Add(vehicle);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Vehicle {VehicleId} created by user.", vehicle.Id);

        return CreatedAtAction(nameof(GetById), new { id = vehicle.Id }, VehicleDto.FromEntity(vehicle));
    }

    [HttpPatch("{id:guid}/maintenance-status")]
    [Authorize(Roles = FleetCoordinatorOrAdmin)]
    public async Task<ActionResult<VehicleDto>> UpdateMaintenanceStatus(
        Guid id,
        UpdateMaintenanceStatusRequest request,
        CancellationToken ct)
    {
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (vehicle is null)
        {
            return NotFound();
        }

        vehicle.MaintenanceStatus = request.Status;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Vehicle {VehicleId} maintenance status updated to {Status}.", id, request.Status);

        return Ok(VehicleDto.FromEntity(vehicle));
    }

    [HttpGet("{id:guid}/availability")]
    [AllowAnonymous]
    public async Task<ActionResult<VehicleAvailabilityResponse>> CheckAvailability(
        Guid id,
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken ct)
    {
        if (from == default || to == default)
        {
            return BadRequest(new { errors = new[] { "Both 'from' and 'to' date parameters are required." } });
        }

        if (from > to)
        {
            return BadRequest(new { errors = new[] { "'from' date cannot be after 'to' date." } });
        }

        var vehicle = await _db.Vehicles
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == id, ct);

        if (vehicle is null)
        {
            return NotFound();
        }

        if (vehicle.MaintenanceStatus != VehicleMaintenanceStatus.Available)
        {
            return Ok(new VehicleAvailabilityResponse(
                id,
                from,
                to,
                false,
                $"Vehicle is currently under {vehicle.MaintenanceStatus}."));
        }

        var isAvailable = await _fleetReservationService.IsVehicleAvailableAsync(id, from, to, ct);
        var reason = isAvailable ? null : "Vehicle has an existing reservation during the specified period.";

        return Ok(new VehicleAvailabilityResponse(id, from, to, isAvailable, reason));
    }

    [HttpGet("assignments")]
    [Authorize(Roles = FleetCoordinatorOrAdmin)]
    public async Task<ActionResult<IReadOnlyList<VehicleAssignmentDetailDto>>> GetAssignments(CancellationToken ct)
    {
        var assignments = await _db.VehicleAssignments
            .Include(a => a.Vehicle)
            .Include(a => a.Driver)
            .Include(a => a.Booking)
                .ThenInclude(b => b.Traveler)
            .Include(a => a.Booking)
                .ThenInclude(b => b.TourPackage)
            .Include(a => a.Booking)
                .ThenInclude(b => b.PackageTier)
            .Include(a => a.Booking)
                .ThenInclude(b => b.ItinerarySteps)
            .Include(a => a.Booking)
                .ThenInclude(b => b.GuideAvailabilities)
                    .ThenInclude(ga => ga.Guide)
            .AsNoTracking()
            .OrderByDescending(a => a.StartDate)
            .ToListAsync(ct);

        var dtos = assignments.Select(a =>
        {
            var guide = a.Booking?.GuideAvailabilities?.FirstOrDefault(ga => ga.Guide != null)?.Guide;
            return new VehicleAssignmentDetailDto(
                a.Id,
                a.VehicleId,
                a.Vehicle != null ? $"{a.Vehicle.Type} ({a.Vehicle.Capacity} seats)" : "Unknown Vehicle",
                a.BookingId,
                a.DriverId,
                a.Driver != null ? a.Driver.Name : "Unknown Driver",
                a.Driver != null ? a.Driver.ContactInfo : "",
                a.StartDate,
                a.EndDate,
                a.CreatedAt,
                a.UpdatedAt,
                a.Vehicle?.Type,
                a.Vehicle?.Capacity,
                a.Vehicle?.HasAC,
                a.Vehicle?.RegistrationNumber,
                a.Booking?.Status,
                a.Booking?.Traveler != null ? a.Booking.Traveler.Name : null,
                TravelerContact: a.Booking?.Traveler != null ? a.Booking.Traveler.ContactNumber : null,
                PackageName: a.Booking?.TourPackage?.Name,
                PackageTier: a.Booking?.PackageTier != null ? a.Booking.PackageTier.ClassType.ToString() : null,
                ItineraryHighlights: a.Booking?.ItinerarySteps?
                    .OrderBy(s => s.DayNumber)
                    .ThenBy(s => s.StartTime)
                    .Select(s => $"Day {s.DayNumber}: {s.Activity} ({s.Location})")
                    .ToList(),
                DriverLicenseNumber: a.Driver?.LicenseNumber,
                GuideName: guide?.Name,
                GuideContact: guide?.ContactInfo,
                GroupSize: a.Booking?.GroupSize,
                SpecialRequests: a.Booking?.SpecialRequests,
                LanguagePreference: a.Booking?.LanguagePreference
            );
        }).ToList();

        return Ok(dtos);
    }

    [HttpGet("assignments/by-booking/{bookingId:guid}")]
    [Authorize]
    public async Task<ActionResult<VehicleAssignmentDetailDto>> GetAssignmentByBookingId(Guid bookingId, CancellationToken ct)
    {
        var booking = await _db.Bookings
            .Include(b => b.Traveler)
            .Include(b => b.TourPackage)
            .Include(b => b.PackageTier)
            .Include(b => b.ItinerarySteps)
            .Include(b => b.GuideAvailabilities)
                .ThenInclude(ga => ga.Guide)
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

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

        var assignment = await _db.VehicleAssignments
            .Include(a => a.Vehicle)
            .Include(a => a.Driver)
            .AsNoTracking()
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync(a => a.BookingId == bookingId, ct);

        if (assignment is null)
        {
            return NotFound();
        }

        var guide = booking.GuideAvailabilities?.FirstOrDefault(ga => ga.Guide != null)?.Guide;

        var dto = new VehicleAssignmentDetailDto(
            assignment.Id,
            assignment.VehicleId,
            assignment.Vehicle != null ? $"{assignment.Vehicle.Type} ({assignment.Vehicle.Capacity} seats)" : "Unknown Vehicle",
            assignment.BookingId,
            assignment.DriverId,
            assignment.Driver != null ? assignment.Driver.Name : "Unknown Driver",
            assignment.Driver != null ? assignment.Driver.ContactInfo : "",
            assignment.StartDate,
            assignment.EndDate,
            assignment.CreatedAt,
            assignment.UpdatedAt,
            assignment.Vehicle?.Type,
            assignment.Vehicle?.Capacity,
            assignment.Vehicle?.HasAC,
            assignment.Vehicle?.RegistrationNumber,
            booking.Status,
            booking.Traveler != null ? booking.Traveler.Name : null,
            TravelerContact: booking.Traveler != null ? booking.Traveler.ContactNumber : null,
            PackageName: booking.TourPackage?.Name,
            PackageTier: booking.PackageTier != null ? booking.PackageTier.ClassType.ToString() : null,
            ItineraryHighlights: booking.ItinerarySteps?
                .OrderBy(s => s.DayNumber)
                .ThenBy(s => s.StartTime)
                .Select(s => $"Day {s.DayNumber}: {s.Activity} ({s.Location})")
                .ToList(),
            DriverLicenseNumber: assignment.Driver?.LicenseNumber,
            GuideName: guide?.Name,
            GuideContact: guide?.ContactInfo,
            GroupSize: booking.GroupSize,
            SpecialRequests: booking.SpecialRequests,
            LanguagePreference: booking.LanguagePreference
        );

        return Ok(dto);
    }

    [HttpPost("{id:guid}/reservations")]
    [Authorize(Roles = FleetCoordinatorOrAdmin)]
    public async Task<ActionResult<VehicleAssignmentDto>> Reserve(
        Guid id,
        ReserveVehicleRequest request,
        CancellationToken ct)
    {
        if (request.StartDate > request.EndDate)
        {
            return BadRequest(new { errors = new[] { "StartDate cannot be after EndDate." } });
        }

        var result = await _fleetReservationService.ReserveVehicleAsync(
            id,
            request.DriverId,
            request.BookingId,
            request.StartDate,
            request.EndDate,
            request.GuideId,
            ct);

        if (!result.Succeeded)
        {
            return Conflict(new { error = result.Error });
        }

        return Ok(VehicleAssignmentDto.FromEntity(result.Assignment!));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = FleetCoordinatorOrAdmin)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (vehicle is null)
        {
            return NotFound();
        }

        _db.Vehicles.Remove(vehicle);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Vehicle {VehicleId} deleted.", id);

        return NoContent();
    }

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }
}
