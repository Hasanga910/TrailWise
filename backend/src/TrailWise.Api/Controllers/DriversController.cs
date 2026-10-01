using System.Security.Claims;
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
    private readonly IAuthService _authService;
    private readonly ILogger<DriversController> _logger;

    public DriversController(
        TrailWiseDbContext db,
        IFleetReservationService fleetReservationService,
        IAuthService authService,
        ILogger<DriversController> logger)
    {
        _db = db;
        _fleetReservationService = fleetReservationService;
        _authService = authService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DriverDto>>> GetAll(CancellationToken ct)
    {
        var drivers = await _db.Drivers
            .Include(d => d.User)
            .AsNoTracking()
            .OrderBy(d => d.Name)
            .ToListAsync(ct);

        return Ok(drivers.Select(DriverDto.FromEntity).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DriverDto>> GetById(Guid id, CancellationToken ct)
    {
        var driver = await _db.Drivers
            .Include(d => d.User)
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
        var email = request.Email?.Trim();
        var password = request.Password?.Trim();

        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { errors = new[] { "Driver name is required." } });
        }

        if (string.IsNullOrWhiteSpace(licenseNumber))
        {
            return BadRequest(new { errors = new[] { "Driver license number is required." } });
        }

        var normalizedLicenseNumber = licenseNumber.ToUpperInvariant();
        var licenseExists = await _db.Drivers.AnyAsync(
            d => d.LicenseNumber.ToUpper() == normalizedLicenseNumber, ct);
        if (licenseExists)
        {
            return Conflict(new { errors = new[] { "Driver License Number already exists." } });
        }

        Guid? linkedUserId = null;

        // If email was provided, provision or link user account with Driver role
        if (!string.IsNullOrWhiteSpace(email))
        {
            var normalizedEmail = email.ToLowerInvariant();
            var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, ct);
            if (existingUser != null)
            {
                if (existingUser.Role != Domain.Enums.UserRole.Driver)
                {
                    existingUser.Role = Domain.Enums.UserRole.Driver;
                }
                if (!string.IsNullOrWhiteSpace(contactInfo) && string.IsNullOrWhiteSpace(existingUser.ContactNumber))
                {
                    existingUser.ContactNumber = contactInfo;
                }
                linkedUserId = existingUser.Id;
            }
            else
            {
                var defaultPassword = !string.IsNullOrWhiteSpace(password) ? password : "ChangeMe123!";
                var authResult = await _authService.CreateUserAsync(
                    name,
                    normalizedEmail,
                    defaultPassword,
                    contactInfo,
                    Domain.Enums.UserRole.Driver,
                    ct);

                if (!authResult.Succeeded || authResult.User == null)
                {
                    return BadRequest(new { errors = new[] { authResult.Error ?? "Failed to create user account for driver." } });
                }

                linkedUserId = authResult.User.Id;
            }
        }

        var driver = new Driver
        {
            Name = name,
            LicenseNumber = licenseNumber,
            ContactInfo = contactInfo,
            UserId = linkedUserId
        };

        _db.Drivers.Add(driver);
        await _db.SaveChangesAsync(ct);

        if (driver.UserId.HasValue)
        {
            driver.User = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == driver.UserId.Value, ct);
        }

        _logger.LogInformation("Driver {DriverId} created (UserId: {UserId}).", driver.Id, driver.UserId);

        return CreatedAtAction(nameof(GetById), new { id = driver.Id }, DriverDto.FromEntity(driver));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = FleetCoordinatorOrAdmin)]
    public async Task<ActionResult<DriverDto>> Update(Guid id, UpdateDriverRequest request, CancellationToken ct)
    {
        var driver = await _db.Drivers.Include(d => d.User).FirstOrDefaultAsync(d => d.Id == id, ct);
        if (driver is null)
        {
            return NotFound();
        }

        var name = request.Name?.Trim() ?? string.Empty;
        var licenseNumber = request.LicenseNumber?.Trim() ?? string.Empty;
        var contactInfo = request.ContactInfo?.Trim() ?? string.Empty;
        var email = request.Email?.Trim();
        var password = request.Password?.Trim();

        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { errors = new[] { "Driver name is required." } });
        }

        if (string.IsNullOrWhiteSpace(licenseNumber))
        {
            return BadRequest(new { errors = new[] { "Driver license number is required." } });
        }

        var normalizedLicenseNumber = licenseNumber.ToUpperInvariant();
        var duplicateExists = await _db.Drivers.AnyAsync(
            d => d.Id != id && d.LicenseNumber.ToUpper() == normalizedLicenseNumber, ct);
        if (duplicateExists)
        {
            return Conflict(new { errors = new[] { "Driver License Number already exists." } });
        }

        driver.Name = name;
        driver.LicenseNumber = licenseNumber;
        driver.ContactInfo = contactInfo;

        if (!string.IsNullOrWhiteSpace(email))
        {
            var normalizedEmail = email.ToLowerInvariant();
            if (driver.UserId.HasValue)
            {
                var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == driver.UserId.Value, ct);
                if (user != null)
                {
                    user.Name = name;
                    user.Email = normalizedEmail;
                    user.ContactNumber = contactInfo;
                    user.Role = Domain.Enums.UserRole.Driver;
                    if (!string.IsNullOrWhiteSpace(password))
                    {
                        var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<Domain.Entities.User>();
                        user.PasswordHash = hasher.HashPassword(user, password);
                    }
                }
            }
            else
            {
                var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, ct);
                if (existingUser != null)
                {
                    driver.UserId = existingUser.Id;
                    driver.User = existingUser;
                    existingUser.Role = Domain.Enums.UserRole.Driver;
                }
                else
                {
                    var defaultPassword = !string.IsNullOrWhiteSpace(password) ? password : "ChangeMe123!";
                    var authResult = await _authService.CreateUserAsync(
                        name,
                        normalizedEmail,
                        defaultPassword,
                        contactInfo,
                        Domain.Enums.UserRole.Driver,
                        ct);

                    if (authResult.Succeeded && authResult.User != null)
                    {
                        driver.UserId = authResult.User.Id;
                        driver.User = authResult.User;
                    }
                }
            }
        }

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

    [HttpGet("me/assignments")]
    [HttpGet("assignments")]
    [Authorize(Roles = "Driver,FleetCoordinator,Admin")]
    public async Task<ActionResult<IReadOnlyList<VehicleAssignmentDetailDto>>> GetMyAssignments(CancellationToken ct)
    {
        var currentUserId = GetUserId();
        if (currentUserId is null)
        {
            return Unauthorized();
        }

        // Find the driver record linked to this user (or fallback to matching by contact info / name)
        var driver = await _db.Drivers
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.UserId == currentUserId.Value, ct);

        if (driver is null)
        {
            // If the user has Driver role, check by contact number or name
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == currentUserId.Value, ct);
            if (user != null)
            {
                driver = await _db.Drivers
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d => (!string.IsNullOrEmpty(user.ContactNumber) && d.ContactInfo == user.ContactNumber) ||
                                              (!string.IsNullOrEmpty(user.Name) && d.Name.ToLower() == user.Name.ToLower()), ct);
            }
        }

        if (driver is null)
        {
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Driver profile not found for current user.");
        }

        var assignments = await _db.VehicleAssignments
            .Where(a => a.DriverId == driver.Id)
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
            .ThenBy(a => a.Id)
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

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }
}

