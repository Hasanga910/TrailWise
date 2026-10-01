namespace TrailWise.Api.Contracts.Guides;

public record GuideProfileDto(
    Guid Id,
    Guid? UserId,
    string Name,
    string Email,
    string ContactInfo,
    string[] Languages,
    string[] Specializations,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
