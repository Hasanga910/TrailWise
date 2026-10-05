namespace TrailWise.Infrastructure.Agents;

public record GuideMatchResult(Guid GuideId, double MatchScore, string Reasoning);

public interface IGuideMatchingAgent
{
    Task<GuideMatchResult> MatchAsync(Guid bookingId, CancellationToken ct = default);

    /// <summary>
    /// Deterministic check that a specific guide satisfies the Guide Matching rules for the booking
    /// (specialization, language when the traveler stated one, and availability for the full dates).
    /// The default only accepts the guide that <see cref="MatchAsync"/> itself proposes; the real
    /// agent overrides it with the full rule evaluation.
    /// </summary>
    async Task<bool> IsQualifiedAsync(Guid bookingId, Guid guideId, CancellationToken ct = default)
    {
        if (guideId == Guid.Empty)
        {
            return false;
        }

        var match = await MatchAsync(bookingId, ct);
        return match.GuideId == guideId;
    }
}
