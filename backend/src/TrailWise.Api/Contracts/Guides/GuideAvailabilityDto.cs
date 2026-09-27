using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Guides;

public record GuideAvailabilityDto(
    Guid Id,
    Guid GuideId,
    DateOnly Date,
    bool IsAvailable,
    Guid? AssignedBookingId)
{
    public static GuideAvailabilityDto FromEntity(GuideAvailability availability) => new(
        availability.Id,
        availability.GuideId,
        availability.Date,
        availability.IsAvailable,
        availability.AssignedBookingId);
}
