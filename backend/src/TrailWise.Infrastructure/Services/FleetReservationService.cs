using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class FleetReservationService : IFleetReservationService
{
    private readonly TrailWiseDbContext _db;
    private readonly IServiceScopeFactory? _scopeFactory;
    private readonly ILogger<FleetReservationService> _logger;
    private readonly IBookingLifecycleService _bookingLifecycleService;
    private readonly IGuideAssignmentService? _guideAssignmentService;
    private readonly IAuditLogService? _auditLogService;

    public FleetReservationService(
        TrailWiseDbContext db,
        ILogger<FleetReservationService> logger,
        IBookingLifecycleService? bookingLifecycleService = null,
        IClock? clock = null,
        IServiceScopeFactory? scopeFactory = null,
        IGuideAssignmentService? guideAssignmentService = null,
        IAuditLogService? auditLogService = null)
    {
        _db = db;
        _logger = logger;
        _bookingLifecycleService = bookingLifecycleService ?? new BookingLifecycleService(clock ?? new SystemClock());
        _scopeFactory = scopeFactory;
        _guideAssignmentService = guideAssignmentService;
        _auditLogService = auditLogService;
    }

    public async Task<bool> IsVehicleAvailableAsync(Guid vehicleId, DateOnly startDate, DateOnly endDate, CancellationToken ct = default)
    {
        if (startDate > endDate)
        {
            return false;
        }

        var vehicle = await _db.Vehicles
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == vehicleId, ct);

        if (vehicle is null || vehicle.MaintenanceStatus != VehicleMaintenanceStatus.Available)
        {
            return false;
        }

        // Inclusive overlap check: a.StartDate <= endDate && startDate <= a.EndDate
        var hasConflict = await _db.VehicleAssignments
            .AsNoTracking()
            .AnyAsync(a => a.VehicleId == vehicleId && a.StartDate <= endDate && startDate <= a.EndDate, ct);

        return !hasConflict;
    }

    public async Task<bool> IsDriverAvailableAsync(Guid driverId, DateOnly startDate, DateOnly endDate, CancellationToken ct = default)
    {
        if (startDate > endDate)
        {
            return false;
        }

        var driverExists = await _db.Drivers
            .AsNoTracking()
            .AnyAsync(d => d.Id == driverId, ct);

        if (!driverExists)
        {
            return false;
        }

        // Inclusive overlap check for driver assignment: a.StartDate <= endDate && startDate <= a.EndDate
        var hasConflict = await _db.VehicleAssignments
            .AsNoTracking()
            .AnyAsync(a => a.DriverId == driverId && a.StartDate <= endDate && startDate <= a.EndDate, ct);

        return !hasConflict;
    }

    public async Task<ReservationResult> ReserveVehicleAsync(
        Guid vehicleId,
        Guid driverId,
        Guid bookingId,
        DateOnly startDate,
        DateOnly endDate,
        Guid? guideId = null,
        CancellationToken ct = default)
    {
        if (startDate > endDate)
        {
            return ReservationResult.Failure("Start date cannot be after end date.");
        }

        // Open an explicit database transaction for concurrency safety when running against a relational store (e.g. Postgres)
        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            var vehicle = await _db.Vehicles
                .FirstOrDefaultAsync(v => v.Id == vehicleId, ct);

            if (vehicle is null)
            {
                if (transaction is not null) await transaction.RollbackAsync(ct);
                return ReservationResult.Failure("Vehicle not found.");
            }

            if (vehicle.MaintenanceStatus != VehicleMaintenanceStatus.Available)
            {
                if (transaction is not null) await transaction.RollbackAsync(ct);
                return ReservationResult.Failure($"Vehicle is not available for reservation (Status: {vehicle.MaintenanceStatus}).");
            }

            var driverExists = await _db.Drivers
                .AnyAsync(d => d.Id == driverId, ct);

            if (!driverExists)
            {
                if (transaction is not null) await transaction.RollbackAsync(ct);
                return ReservationResult.Failure("Driver not found.");
            }

            var booking = await _db.Bookings
                .Include(b => b.PackageTier)
                .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

            if (booking is null)
            {
                if (transaction is not null) await transaction.RollbackAsync(ct);
                return ReservationResult.Failure("Booking not found.");
            }

            // Re-verify availability inside the transaction/lock
            var hasVehicleConflict = await _db.VehicleAssignments
                .AnyAsync(a => a.VehicleId == vehicleId && a.StartDate <= endDate && startDate <= a.EndDate, ct);

            if (hasVehicleConflict)
            {
                if (transaction is not null) await transaction.RollbackAsync(ct);
                return ReservationResult.Failure("Vehicle has a conflicting assignment during the selected dates.");
            }

            // Also check driver overlap to ensure driver isn't double-booked
            var hasDriverConflict = await _db.VehicleAssignments
                .AnyAsync(a => a.DriverId == driverId && a.StartDate <= endDate && startDate <= a.EndDate, ct);

            if (hasDriverConflict)
            {
                if (transaction is not null) await transaction.RollbackAsync(ct);
                return ReservationResult.Failure("Driver has a conflicting assignment during the selected dates.");
            }

            // If a guide is provided, check for conflicts and assign
            if (guideId.HasValue && guideId.Value != Guid.Empty)
            {
                var guideExists = await _db.Guides.AnyAsync(g => g.Id == guideId.Value, ct);
                if (!guideExists)
                {
                    if (transaction is not null) await transaction.RollbackAsync(ct);
                    return ReservationResult.Failure("Tour guide not found.");
                }

                // Check guide availability overlap
                var hasGuideConflict = await _db.GuideAvailabilities
                    .AnyAsync(a => a.GuideId == guideId.Value
                                   && a.Date >= startDate
                                   && a.Date <= endDate
                                   && ((a.AssignedBookingId != null && a.AssignedBookingId != bookingId) || (!a.IsAvailable && a.AssignedBookingId != bookingId)), ct);

                if (hasGuideConflict)
                {
                    if (transaction is not null) await transaction.RollbackAsync(ct);
                    return ReservationResult.Failure("Selected tour guide has a conflicting assignment during the selected dates.");
                }

                // If guide assignment service is available, assign rows; otherwise directly upsert
                if (_guideAssignmentService is not null)
                {
                    var guideAssigned = await _guideAssignmentService.AssignGuideAsync(bookingId, guideId.Value, ct);
                    if (!guideAssigned)
                    {
                        if (transaction is not null) await transaction.RollbackAsync(ct);
                        return ReservationResult.Failure("Selected tour guide is no longer available for this booking.");
                    }
                }
                else
                {
                    // Fallback upsert for guide availability rows
                    var existingAvailabilities = await _db.GuideAvailabilities
                        .Where(a => a.GuideId == guideId.Value && a.Date >= startDate && a.Date <= endDate)
                        .ToListAsync(ct);
                    var existingByDate = existingAvailabilities.ToDictionary(a => a.Date);
                    var daysCount = endDate.DayNumber - startDate.DayNumber;

                    for (var i = 0; i <= daysCount; i++)
                    {
                        var date = startDate.AddDays(i);
                        if (existingByDate.TryGetValue(date, out var existingRow))
                        {
                            existingRow.AssignedBookingId = bookingId;
                            existingRow.IsAvailable = false;
                            existingRow.UpdatedAt = DateTimeOffset.UtcNow;
                        }
                        else
                        {
                            _db.GuideAvailabilities.Add(new GuideAvailability
                            {
                                GuideId = guideId.Value,
                                Date = date,
                                AssignedBookingId = bookingId,
                                IsAvailable = false,
                                CreatedAt = DateTimeOffset.UtcNow,
                                UpdatedAt = DateTimeOffset.UtcNow
                            });
                        }
                    }
                }
            }

            var assignment = new VehicleAssignment
            {
                VehicleId = vehicleId,
                DriverId = driverId,
                BookingId = bookingId,
                StartDate = startDate,
                EndDate = endDate
            };

            _db.VehicleAssignments.Add(assignment);

            // Check resource allocation completeness:
            // A booking can ONLY transition to Confirmed when vehicle, driver, AND tour guide are all assigned.
            bool hasGuide = (guideId.HasValue && guideId.Value != Guid.Empty) ||
                            await _db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == bookingId && a.GuideId != Guid.Empty, ct);
            bool hasVehicleAndDriver = vehicleId != Guid.Empty && driverId != Guid.Empty;

            bool transitionedToConfirmed = false;
            if (hasGuide && hasVehicleAndDriver && (booking.Status == BookingStatus.NeedsManualReview || booking.Status == BookingStatus.PendingApproval || booking.Status == BookingStatus.PlanProposed))
            {
                transitionedToConfirmed = _bookingLifecycleService.TransitionToConfirmed(booking);
                _logger.LogInformation("Booking {BookingId} transitioned to Confirmed after complete allocation (Vehicle, Driver, Guide).", bookingId);
            }
            else
            {
                _logger.LogInformation("Booking {BookingId} vehicle/driver assigned but not transitioned to Confirmed (HasGuide: {HasGuide}, HasVehicleAndDriver: {HasVehicleAndDriver}, Status: {Status}).",
                    bookingId, hasGuide, hasVehicleAndDriver, booking.Status);
            }

            await _db.SaveChangesAsync(ct);

            if (transaction is not null)
            {
                await transaction.CommitAsync(ct);
            }

            _logger.LogInformation("Vehicle {VehicleId} successfully reserved for booking {BookingId} from {StartDate} to {EndDate}.",
                vehicleId, bookingId, startDate, endDate);

            if (transitionedToConfirmed && _scopeFactory is not null)
            {
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

            return ReservationResult.Success(assignment);
        }
        catch (Exception ex)
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(ct);
            }
            _logger.LogError(ex, "Error reserving vehicle {VehicleId} for booking {BookingId}.", vehicleId, bookingId);
            throw;
        }
    }

    public async Task<ReservationResult> ReassignResourcesAsync(
        Guid bookingId,
        Guid? newVehicleId,
        Guid? newDriverId,
        Guid? newGuideId,
        string? reason,
        Guid performedBy,
        CancellationToken ct = default)
    {
        var booking = await _db.Bookings
            .Include(b => b.PackageTier)
            .Include(b => b.VehicleAssignments)
                .ThenInclude(va => va.Vehicle)
            .Include(b => b.VehicleAssignments)
                .ThenInclude(va => va.Driver)
            .Include(b => b.GuideAvailabilities)
                .ThenInclude(ga => ga.Guide)
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking is null)
        {
            return ReservationResult.Failure("Booking not found.");
        }

        if (booking.Status != BookingStatus.Confirmed)
        {
            return ReservationResult.Failure($"Cannot reassign resources for booking in '{booking.Status}' status. Only Confirmed bookings can have resources reassigned.");
        }

        var startDate = booking.StartDate;
        var endDate = booking.EndDate;

        var existingAssignment = booking.VehicleAssignments.FirstOrDefault();
        var effectiveVehicleId = newVehicleId ?? existingAssignment?.VehicleId;
        var effectiveDriverId = newDriverId ?? existingAssignment?.DriverId;

        if (!effectiveVehicleId.HasValue || effectiveVehicleId.Value == Guid.Empty)
        {
            return ReservationResult.Failure("A valid vehicle must be specified or currently assigned.");
        }

        if (!effectiveDriverId.HasValue || effectiveDriverId.Value == Guid.Empty)
        {
            return ReservationResult.Failure("A valid driver must be specified or currently assigned.");
        }

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            // 1. Vehicle validation & overlap check
            if (newVehicleId.HasValue && newVehicleId.Value != Guid.Empty &&
                (existingAssignment == null || existingAssignment.VehicleId != newVehicleId.Value))
            {
                var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == newVehicleId.Value, ct);
                if (vehicle is null)
                {
                    if (transaction is not null) await transaction.RollbackAsync(ct);
                    return ReservationResult.Failure("Replacement vehicle not found.");
                }

                if (vehicle.MaintenanceStatus != VehicleMaintenanceStatus.Available)
                {
                    if (transaction is not null) await transaction.RollbackAsync(ct);
                    return ReservationResult.Failure($"Replacement vehicle is not available (Status: {vehicle.MaintenanceStatus}).");
                }

                if (vehicle.Capacity < booking.GroupSize)
                {
                    if (transaction is not null) await transaction.RollbackAsync(ct);
                    return ReservationResult.Failure($"Replacement vehicle capacity ({vehicle.Capacity}) cannot accommodate group size ({booking.GroupSize}).");
                }

                var hasVehicleConflict = await _db.VehicleAssignments
                    .AnyAsync(a => a.VehicleId == newVehicleId.Value
                                   && a.BookingId != bookingId
                                   && a.StartDate <= endDate
                                   && startDate <= a.EndDate, ct);

                if (hasVehicleConflict)
                {
                    if (transaction is not null) await transaction.RollbackAsync(ct);
                    return ReservationResult.Failure("Selected replacement vehicle has a conflicting assignment during the active tour dates.");
                }
            }

            // 2. Driver validation & overlap check
            if (newDriverId.HasValue && newDriverId.Value != Guid.Empty &&
                (existingAssignment == null || existingAssignment.DriverId != newDriverId.Value))
            {
                var driverExists = await _db.Drivers.AnyAsync(d => d.Id == newDriverId.Value, ct);
                if (!driverExists)
                {
                    if (transaction is not null) await transaction.RollbackAsync(ct);
                    return ReservationResult.Failure("Replacement driver not found.");
                }

                var hasDriverConflict = await _db.VehicleAssignments
                    .AnyAsync(a => a.DriverId == newDriverId.Value
                                   && a.BookingId != bookingId
                                   && a.StartDate <= endDate
                                   && startDate <= a.EndDate, ct);

                if (hasDriverConflict)
                {
                    if (transaction is not null) await transaction.RollbackAsync(ct);
                    return ReservationResult.Failure("Selected replacement driver has a conflicting assignment during the active tour dates.");
                }
            }

            // 3. Tour Guide validation & overlap check
            if (newGuideId.HasValue && newGuideId.Value != Guid.Empty)
            {
                var guideExists = await _db.Guides.AnyAsync(g => g.Id == newGuideId.Value, ct);
                if (!guideExists)
                {
                    if (transaction is not null) await transaction.RollbackAsync(ct);
                    return ReservationResult.Failure("Replacement tour guide not found.");
                }

                var hasGuideConflict = await _db.GuideAvailabilities
                    .AnyAsync(a => a.GuideId == newGuideId.Value
                                   && a.Date >= startDate
                                   && a.Date <= endDate
                                   && ((a.AssignedBookingId != null && a.AssignedBookingId != bookingId) || (!a.IsAvailable && a.AssignedBookingId != bookingId)), ct);

                if (hasGuideConflict)
                {
                    if (transaction is not null) await transaction.RollbackAsync(ct);
                    return ReservationResult.Failure("Selected replacement tour guide has a conflicting assignment during the active tour dates.");
                }
            }

            // Store previous assignments for audit logging
            var oldVehicleId = existingAssignment?.VehicleId;
            var oldDriverId = existingAssignment?.DriverId;
            var oldGuideId = booking.GuideAvailabilities.FirstOrDefault(ga => ga.AssignedBookingId == bookingId)?.GuideId;

            // Commit vehicle/driver assignment changes
            VehicleAssignment effectiveAssignment;
            if (existingAssignment is not null)
            {
                existingAssignment.VehicleId = effectiveVehicleId.Value;
                existingAssignment.DriverId = effectiveDriverId.Value;
                effectiveAssignment = existingAssignment;
            }
            else
            {
                effectiveAssignment = new VehicleAssignment
                {
                    VehicleId = effectiveVehicleId.Value,
                    DriverId = effectiveDriverId.Value,
                    BookingId = bookingId,
                    StartDate = startDate,
                    EndDate = endDate
                };
                _db.VehicleAssignments.Add(effectiveAssignment);
            }

            // Commit tour guide changes
            if (newGuideId.HasValue && newGuideId.Value != Guid.Empty && newGuideId.Value != oldGuideId)
            {
                // Release old guide assignment rows for this booking
                var oldGuideRows = await _db.GuideAvailabilities
                    .Where(a => a.AssignedBookingId == bookingId && a.GuideId != newGuideId.Value)
                    .ToListAsync(ct);

                foreach (var row in oldGuideRows)
                {
                    row.AssignedBookingId = null;
                    row.IsAvailable = true;
                    row.UpdatedAt = DateTimeOffset.UtcNow;
                }

                // Reassign new guide
                var newGuideRows = await _db.GuideAvailabilities
                    .Where(a => a.GuideId == newGuideId.Value && a.Date >= startDate && a.Date <= endDate)
                    .ToListAsync(ct);
                var existingByDate = newGuideRows.ToDictionary(a => a.Date);
                var daysCount = endDate.DayNumber - startDate.DayNumber;

                for (var i = 0; i <= daysCount; i++)
                {
                    var date = startDate.AddDays(i);
                    if (existingByDate.TryGetValue(date, out var row))
                    {
                        row.AssignedBookingId = bookingId;
                        row.IsAvailable = false;
                        row.UpdatedAt = DateTimeOffset.UtcNow;
                    }
                    else
                    {
                        _db.GuideAvailabilities.Add(new GuideAvailability
                        {
                            GuideId = newGuideId.Value,
                            Date = date,
                            IsAvailable = false,
                            AssignedBookingId = bookingId,
                            CreatedAt = DateTimeOffset.UtcNow
                        });
                    }
                }
            }

            await _db.SaveChangesAsync(ct);

            // Audit log recording
            if (_auditLogService is not null)
            {
                await _auditLogService.LogAsync(
                    "Booking",
                    bookingId,
                    "ReassignResources",
                    performedBy,
                    new
                    {
                        OldVehicleId = oldVehicleId,
                        NewVehicleId = effectiveVehicleId,
                        OldDriverId = oldDriverId,
                        NewDriverId = effectiveDriverId,
                        OldGuideId = oldGuideId,
                        NewGuideId = newGuideId ?? oldGuideId,
                        Reason = reason ?? "Operational emergency reassignment"
                    },
                    ct);
            }

            if (transaction is not null)
            {
                await transaction.CommitAsync(ct);
            }

            _logger.LogInformation("Resources successfully reassigned for Confirmed booking {BookingId}.", bookingId);

            // Dispatch concise updated traveler SMS
            if (_scopeFactory is not null)
            {
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
                        _logger.LogError(notifEx, "Failed to dispatch updated traveler SMS for Booking {BookingId}", bookingId);
                    }
                });
            }

            return ReservationResult.Success(effectiveAssignment);
        }
        catch (Exception ex)
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(ct);
            }
            _logger.LogError(ex, "Error reassigning resources for booking {BookingId}.", bookingId);
            throw;
        }
    }

    public async Task<int> ReleaseBookingAssignmentsAsync(Guid bookingId, CancellationToken ct = default)
    {
        var assignments = await _db.VehicleAssignments
            .Where(a => a.BookingId == bookingId)
            .ToListAsync(ct);

        if (assignments.Count == 0)
        {
            return 0;
        }

        _db.VehicleAssignments.RemoveRange(assignments);
        var removedCount = await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Released {Count} vehicle assignments for cancelled booking {BookingId}.", assignments.Count, bookingId);
        return assignments.Count;
    }
}
