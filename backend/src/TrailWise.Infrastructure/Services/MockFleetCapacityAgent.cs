namespace TrailWise.Infrastructure.Services;

/// <summary>
/// Stand-in for Person 3's real Fleet &amp; Capacity Agent. Returns plausible, deterministic
/// (not randomized) values so the coordinator workflow and its tests never flake. Swap the
/// DI registration in DependencyInjection.cs for the real implementation once it exists —
/// no change needed in CoordinatorAgentService itself.
/// </summary>
public class MockFleetCapacityAgent : IFleetCapacityAgent
{
    public Task<VehicleMatchResult> MatchAsync(Guid bookingId, CancellationToken ct = default) =>
        Task.FromResult(new VehicleMatchResult(
            Guid.NewGuid(),
            Guid.NewGuid(),
            AcMatch: true,
            SeatConfigMatch: true,
            ConflictCheck: false));
}
