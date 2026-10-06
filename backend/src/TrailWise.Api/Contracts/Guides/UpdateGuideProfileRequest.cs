namespace TrailWise.Api.Contracts.Guides;

public record UpdateGuideProfileRequest(
    string Name,
    string Email,
    string? ContactInfo,
    string[]? Languages,
    string[]? Specializations);
