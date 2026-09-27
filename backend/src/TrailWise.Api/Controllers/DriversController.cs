using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Fleet;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/drivers")]
public class DriversController : ControllerBase
{
    private const string FleetCoordinatorOrAdmin = "FleetCoordinator,Admin";

    private readonly TrailWiseDbContext _db;
    private readonly ILogger<DriversController> _logger;

    public DriversController(TrailWiseDbContext db, ILogger<DriversController> logger)
    {
        _db = db;
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
}
