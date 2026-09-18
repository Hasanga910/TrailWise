namespace TrailWise.Infrastructure.Services;

/// <summary>
/// Stand-in for Person 2's real Guide Matching Agent. Returns plausible, deterministic
/// (not randomized) values so the coordinator workflow and its tests never flake. Swap the
/// DI registration in DependencyInjection.cs for the real implementation once it exists —
/// no change needed in CoordinatorAgentService itself.
/// </summary>
public class MockGuideMatchingAgent : IGuideMatchingAgent
{
    public Task<GuideMatchResult> MatchAsync(Guid bookingId, CancellationToken ct = default) =>
        Task.FromResult(new GuideMatchResult(
            Guid.NewGuid(),
            0.9,
            "Mock match: best-rated available guide for this package's theme and dates."));
}
