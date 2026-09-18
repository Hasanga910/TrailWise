namespace TrailWise.Infrastructure.Services;

public record GuideMatchResult(Guid GuideId, double MatchScore, string Reasoning);

public interface IGuideMatchingAgent
{
    Task<GuideMatchResult> MatchAsync(Guid bookingId, CancellationToken ct = default);
}
