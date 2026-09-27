namespace TrailWise.Infrastructure.Agents;

public record TravelerPreferences(
    List<string> DietaryNotes,
    List<string> AccessibilityNeeds,
    List<string> OtherNotes,
    bool ContainedSuspiciousInstructions)
{
    public static TravelerPreferences Empty { get; } = new([], [], [], false);
}

public interface IPreferenceExtractionAgent
{
    Task<TravelerPreferences> ExtractAsync(string? specialRequests, CancellationToken ct = default);
}
