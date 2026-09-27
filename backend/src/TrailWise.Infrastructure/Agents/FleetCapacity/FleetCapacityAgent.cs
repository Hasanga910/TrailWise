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
                .ToListAsync(ct);

            // Find an available vehicle that satisfies capacity and maintenance status, avoiding overlap
            var candidateVehicles = await _db.Vehicles
                .AsNoTracking()
                .Where(v => v.MaintenanceStatus == VehicleMaintenanceStatus.Available
                            && v.Capacity >= groupSize
                            && !conflictingVehicleIds.Contains(v.Id))
                .OrderBy(v => v.Capacity)
                .ToListAsync(ct);

            if (candidateVehicles.Count == 0)
            {
                _logger.LogWarning("No available vehicle found for booking {BookingId} (GroupSize: {GroupSize}, Dates: {StartDate} to {EndDate}).",
                    bookingId, groupSize, startDate, endDate);
                return new VehicleMatchResult(Guid.Empty, Guid.Empty, false, false, true);
            }

            // Prefer vehicle that satisfies AC requirement if needed, otherwise first candidate
            var selectedVehicle = candidateVehicles.FirstOrDefault(v => !requiresAc || v.HasAC)
                                  ?? candidateVehicles[0];

            var acMatch = !requiresAc || selectedVehicle.HasAC;
            var seatConfigMatch = selectedVehicle.Capacity >= groupSize;

            // Find an available driver not scheduled during the booking dates
            var conflictingDriverIds = await _db.VehicleAssignments
                .AsNoTracking()
                .Where(a => a.StartDate <= endDate && startDate <= a.EndDate)
                .Select(a => a.DriverId)
                .ToListAsync(ct);

            var availableDriver = await _db.Drivers
                .AsNoTracking()
                .Where(d => !conflictingDriverIds.Contains(d.Id))
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