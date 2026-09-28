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
    string? LanguagePreference = null)
{
    public static BookingSummaryDto FromEntity(Booking booking) => new(
        booking.Id,
        booking.Traveler.Name,
        booking.TourPackage.Name,
        booking.Status,
        booking.CreatedAt,
        booking.StartDate,
        booking.GroupSize,
        booking.EndDate,
        booking.LanguagePreference);
}
