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
    string? SpecialRequests,
    BookingStatus Status,
    bool IsLargeGroup,
    string? LanguagePreference = null,
    AssignedGuideDto? AssignedGuide = null)
{
    // Duplicated by value in TrailWise.Infrastructure.Agents.BookingApprovalEvaluator.LargeGroupThreshold
    // since Infrastructure cannot reference this (Api) project. Keep both in sync if this ever changes.
    public const int LargeGroupThreshold = 10;

    public static BookingDto FromEntity(Booking booking)
    {
        var guide = booking.GuideAvailabilities
            ?.Select(ga => ga.Guide)
            .FirstOrDefault(g => g != null);

        return new(
            booking.Id,
            booking.TravelerId,
            booking.TourPackageId,
            booking.TourPackage.Name,
            PackageTierDto.FromEntity(booking.PackageTier),
            booking.GroupSize,
            booking.StartDate,
            booking.EndDate,
            booking.BudgetPerPerson,
            booking.SpecialRequests,
            booking.Status,
            booking.GroupSize > LargeGroupThreshold,
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
