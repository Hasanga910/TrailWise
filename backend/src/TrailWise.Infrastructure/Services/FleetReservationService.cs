using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class FleetReservationService : IFleetReservationService
{
    private readonly TrailWiseDbContext _db;
    private readonly ILogger<FleetReservationService> _logger;

    public FleetReservationService(TrailWiseDbContext db, ILogger<FleetReservationService> logger)
    {
        _db = db;
        _logger = logger;
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

    public async Task<ReservationResult> ReserveVehicleAsync(
        Guid vehicleId,
        Guid driverId,
        Guid bookingId,
        DateOnly startDate,
        DateOnly endDate,
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

            var bookingExists = await _db.Bookings
                .AnyAsync(b => b.Id == bookingId, ct);

            if (!bookingExists)
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

            var assignment = new VehicleAssignment
            {
                VehicleId = vehicleId,
                DriverId = driverId,
                BookingId = bookingId,
                StartDate = startDate,
                EndDate = endDate
            };

            _db.VehicleAssignments.Add(assignment);
            await _db.SaveChangesAsync(ct);

            if (transaction is not null)
            {
                await transaction.CommitAsync(ct);
            }

            _logger.LogInformation("Vehicle {VehicleId} successfully reserved for booking {BookingId} from {StartDate} to {EndDate}.",
                vehicleId, bookingId, startDate, endDate);

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
}
