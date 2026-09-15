using TrailWise.Api.Contracts.Packages;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Bookings;

public record BookingDto(
    Guid Id,
    Guid TravelerId,
    Guid TourPackageId,
    string TourPackageName,
    PackageTierDto PackageTier,
    int GroupSize,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal BudgetPerPerson,
    BookingStatus Status,
    bool IsLargeGroup)
{
    public const int LargeGroupThreshold = 10;

    public static BookingDto FromEntity(Booking booking) => new(
        booking.Id,
        booking.TravelerId,
        booking.TourPackageId,
        booking.TourPackage.Name,
        PackageTierDto.FromEntity(booking.PackageTier),
        booking.GroupSize,
        booking.StartDate,
        booking.EndDate,
        booking.BudgetPerPerson,
        booking.Status,
        booking.GroupSize > LargeGroupThreshold);
}
