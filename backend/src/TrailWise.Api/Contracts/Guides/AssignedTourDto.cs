using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Guides;

public record AssignedTourDto(
    Guid BookingId,
    DateOnly StartDate,
    DateOnly EndDate,
    int GroupSize,
    BookingStatus Status,
    Guid TourPackageId,
    string TourPackageName,
    string Theme,
    IReadOnlyList<string> Locations,
    string? SpecialRequests,
    Guid GuideId,
    string GuideName,
    bool Attended = false,
    bool Completed = false,
    string? GuideNotes = null)
{
    public static AssignedTourDto FromEntity(Booking booking, Guide guide) => new(
        booking.Id,
        booking.StartDate,
        booking.EndDate,
        booking.GroupSize,
        booking.Status,
        booking.TourPackageId,
        booking.TourPackage.Name,
        booking.TourPackage.Theme,
        booking.TourPackage.Locations.OrderBy(l => l.Id).Select(l => l.Name).ToList(),
        booking.SpecialRequests,
        guide.Id,
        guide.Name,
        booking.Attended,
        booking.Completed,
        booking.GuideNotes);
}
