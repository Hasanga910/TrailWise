using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Bookings;

public record BookingSummaryDto(
    Guid Id,
    string TravelerName,
    string PackageName,
    BookingStatus Status,
    DateTimeOffset CreatedAt,
    DateOnly StartDate,
    int GroupSize,
    DateOnly? EndDate = null,
    string? LanguagePreference = null,
    AssignedGuideDto? AssignedGuide = null)
{
    public static BookingSummaryDto FromEntity(Booking booking)
    {
        var guide = booking.GuideAvailabilities
            ?.Select(ga => ga.Guide)
            .FirstOrDefault(g => g != null);

        return new(
            booking.Id,
            booking.Traveler.Name,
            booking.TourPackage.Name,
            booking.Status,
            booking.CreatedAt,
            booking.StartDate,
            booking.GroupSize,
            booking.EndDate,
            booking.LanguagePreference,
            guide != null
                ? new AssignedGuideDto(
                    guide.Id,
                    guide.Name,
                    guide.ContactInfo,
                    guide.Languages,
                    guide.Specializations)
                : null);
    }
}
