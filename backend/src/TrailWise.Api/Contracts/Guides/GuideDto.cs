using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Guides;

public record GuideDto(
    Guid Id,
    string Name,
    string[] Languages,
    string[] Specializations,
    string ContactInfo,
    Guid? UserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static GuideDto FromEntity(Guide guide) => new(
        guide.Id,
        guide.Name,
        guide.Languages,
        guide.Specializations,
        guide.ContactInfo,
        guide.UserId,
        guide.CreatedAt,
        guide.UpdatedAt);
}
