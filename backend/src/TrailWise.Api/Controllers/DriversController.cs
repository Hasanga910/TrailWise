using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Fleet;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/drivers")]
public class DriversController : ControllerBase
{
    private const string FleetCoordinatorOrAdmin = "FleetCoordinator,Admin";

    private readonly TrailWiseDbContext _db;
    private readonly IFleetReservationService _fleetReservationService;
    private readonly ILogger<DriversController> _logger;

    public DriversController(
        TrailWiseDbContext db,
        IFleetReservationService fleetReservationService,
        ILogger<DriversController> logger)
    {
        _db = db;
        _fleetReservationService = fleetReservationService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DriverDto>>> GetAll(CancellationToken ct)
    {
        var drivers = await _db.Drivers
            .AsNoTracking()
            .OrderBy(d => d.Name)
            .ToListAsync(ct);

        return Ok(drivers.Select(DriverDto.FromEntity).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DriverDto>> GetById(Guid id, CancellationToken ct)
    {
        var driver = await _db.Drivers
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        if (driver is null)
        {
            return NotFound();
        }

        return Ok(DriverDto.FromEntity(driver));
    }

    [HttpGet("{id:guid}/availability")]
    [AllowAnonymous]
    public async Task<ActionResult<DriverAvailabilityResponse>> CheckAvailability(
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

        var driver = await _db.Drivers
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        if (driver is null)
        {
            return NotFound();
        }

        var isAvailable = await _fleetReservationService.IsDriverAvailableAsync(id, from, to, ct);
        var reason = isAvailable ? null : "Driver has an existing vehicle/tour assignment during the specified period.";

        return Ok(new DriverAvailabilityResponse(id, from, to, isAvailable, reason));
    }

    [HttpPost]
    [Authorize(Roles = FleetCoordinatorOrAdmin)]
    public async Task<ActionResult<DriverDto>> Create(CreateDriverRequest request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        var licenseNumber = request.LicenseNumber?.Trim() ?? string.Empty;
        var contactInfo = request.ContactInfo?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { errors = new[] { "Driver name is required." } });
        }

        if (string.IsNullOrWhiteSpace(licenseNumber))
        {
            return BadRequest(new { errors = new[] { "Driver license number is required." } });
        }

        var driver = new Driver
        {
            Name = name,
            LicenseNumber = licenseNumber,
            ContactInfo = contactInfo
        };

        _db.Drivers.Add(driver);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Driver {DriverId} created.", driver.Id);

        return CreatedAtAction(nameof(GetById), new { id = driver.Id }, DriverDto.FromEntity(driver));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = FleetCoordinatorOrAdmin)]
    public async Task<ActionResult<DriverDto>> Update(Guid id, UpdateDriverRequest request, CancellationToken ct)
    {
        var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (driver is null)
        {
            return NotFound();
        }

        var name = request.Name?.Trim() ?? string.Empty;
        var licenseNumber = request.LicenseNumber?.Trim() ?? string.Empty;
        var contactInfo = request.ContactInfo?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { errors = new[] { "Driver name is required." } });
        }

        if (string.IsNullOrWhiteSpace(licenseNumber))
        {
            return BadRequest(new { errors = new[] { "Driver license number is required." } });
        }

        driver.Name = name;
        driver.LicenseNumber = licenseNumber;
        driver.ContactInfo = contactInfo;

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Driver {DriverId} updated.", driver.Id);

        return Ok(DriverDto.FromEntity(driver));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = FleetCoordinatorOrAdmin)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (driver is null)
        {
            return NotFound();
        }

        var hasAssignments = await _db.VehicleAssignments.AnyAsync(a => a.DriverId == id, ct);
        if (hasAssignments)
        {
            return Conflict(new { errors = new[] { "Cannot delete driver because they have vehicle assignments." } });
        }

        _db.Drivers.Remove(driver);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Driver {DriverId} deleted.", id);

        return NoContent();
    }
}

