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

        var vehicle = new Vehicle
        {
            Type = request.Type,
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
}
