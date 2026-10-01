using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Agents;

public class FleetCapacityAgent : IFleetCapacityAgent
{
    private readonly TrailWiseDbContext _db;
    private readonly ILogger<FleetCapacityAgent> _logger;

    public FleetCapacityAgent(TrailWiseDbContext db, ILogger<FleetCapacityAgent> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<VehicleMatchResult> MatchAsync(Guid bookingId, CancellationToken ct = default)
    {
        try
        {
            var booking = await _db.Bookings
                .AsNoTracking()
                .Include(b => b.PackageTier)
                .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

            if (booking is null)
            {
                _logger.LogWarning("Booking {BookingId} not found during fleet matching.", bookingId);
                return new VehicleMatchResult(Guid.Empty, Guid.Empty, false, false, true);
            }

            var requiresAc = booking.PackageTier?.RequiresAC ?? false;
            var groupSize = booking.GroupSize;
            var startDate = booking.StartDate;
            var endDate = booking.EndDate;

            // Query booked vehicle assignments that overlap with this booking's date range
            var conflictingVehicleIds = await _db.VehicleAssignments
                .AsNoTracking()
                .Where(a => a.StartDate <= endDate && startDate <= a.EndDate)
                .Select(a => a.VehicleId)
                .Distinct()
                .ToListAsync(ct);

            // Filter vehicles that:
            // 1. Are available (not under maintenance or retired)
            // 2. Have capacity >= groupSize
            // 3. Meet the AC requirement if requested
            // 4. Have no overlapping vehicle assignments
            var query = _db.Vehicles
                .AsNoTracking()
                .Where(v => v.MaintenanceStatus == VehicleMaintenanceStatus.Available
                            && v.Capacity >= groupSize
                            && !conflictingVehicleIds.Contains(v.Id));

            if (requiresAc)
            {
                query = query.Where(v => v.HasAC);
            }

            // Always select the vehicle with the least unused seating capacity (smallest suitable available vehicle)
            var selectedVehicle = await query
                .OrderBy(v => v.Capacity - groupSize)
                .ThenBy(v => v.Capacity)
                .FirstOrDefaultAsync(ct);

            // Fallback: If requiresAc was true but no AC vehicle exists, find the smallest available vehicle meeting capacity
            var acMatch = true;
            if (selectedVehicle is null && requiresAc)
            {
                acMatch = false;
                selectedVehicle = await _db.Vehicles
                    .AsNoTracking()
                    .Where(v => v.MaintenanceStatus == VehicleMaintenanceStatus.Available
                                && v.Capacity >= groupSize
                                && !conflictingVehicleIds.Contains(v.Id))
                    .OrderBy(v => v.Capacity - groupSize)
                    .ThenBy(v => v.Capacity)
                    .FirstOrDefaultAsync(ct);
            }

            if (selectedVehicle is null)
            {
                _logger.LogWarning("No suitable available vehicle found for booking {BookingId} (GroupSize: {GroupSize}, Dates: {StartDate} to {EndDate}, RequiresAC: {RequiresAC}).",
                    bookingId, groupSize, startDate, endDate, requiresAc);
                return new VehicleMatchResult(Guid.Empty, Guid.Empty, false, false, true);
            }

            var seatConfigMatch = selectedVehicle.Capacity >= groupSize;

            // Find an available driver not scheduled during the full booking dates
            var conflictingDriverIds = await _db.VehicleAssignments
                .AsNoTracking()
                .Where(a => a.StartDate <= endDate && startDate <= a.EndDate)
                .Select(a => a.DriverId)
                .Distinct()
                .ToListAsync(ct);

            var availableDriver = await _db.Drivers
                .AsNoTracking()
                .Where(d => !conflictingDriverIds.Contains(d.Id))
                .OrderBy(d => d.Name)
                .FirstOrDefaultAsync(ct);

            if (availableDriver is null)
            {
                _logger.LogWarning("No available driver found for booking {BookingId} between {StartDate} and {EndDate}.",
                    bookingId, startDate, endDate);
                return new VehicleMatchResult(Guid.Empty, Guid.Empty, false, false, true);
            }

            var conflictCheck = !acMatch || !seatConfigMatch;

            _logger.LogInformation(
                "Matched vehicle {VehicleId} and driver {DriverId} for booking {BookingId}. AcMatch: {AcMatch}, SeatMatch: {SeatMatch}, Conflict: {ConflictCheck}",
                selectedVehicle.Id, availableDriver.Id, bookingId, acMatch, seatConfigMatch, conflictCheck);

            return new VehicleMatchResult(
                selectedVehicle.Id,
                availableDriver.Id,
                acMatch,
                seatConfigMatch,
                conflictCheck);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing FleetCapacityAgent for booking {BookingId}", bookingId);
            return new VehicleMatchResult(Guid.Empty, Guid.Empty, false, false, true);
        }
    }
}