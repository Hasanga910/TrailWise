namespace TrailWise.Api.Contracts.Guides;

public record AvailableGuideDto(
    Guid GuideId,
    string Name,
    string[] Languages,
    string[] Specializations,
    string ContactInfo,
    bool MatchesSpecialization,
    bool MatchesLanguage,
    string? Notes = null);
