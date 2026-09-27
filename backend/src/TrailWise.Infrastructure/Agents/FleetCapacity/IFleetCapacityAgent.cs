namespace TrailWise.Infrastructure.Agents;

public record VehicleMatchResult(
    Guid VehicleId,
    Guid DriverId,
    bool AcMatch,
    bool SeatConfigMatch,
    bool ConflictCheck);

public interface IFleetCapacityAgent
{
    Task<VehicleMatchResult> MatchAsync(Guid bookingId, CancellationToken ct = default);
}
