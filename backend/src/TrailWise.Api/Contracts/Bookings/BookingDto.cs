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
    bool HasReview = false)
{
    // Duplicated by value in TrailWise.Infrastructure.Agents.BookingApprovalEvaluator.LargeGroupThreshold
    // since Infrastructure cannot reference this (Api) project. Keep both in sync if this ever changes.
    public const int LargeGroupThreshold = 10;

    public static BookingDto FromEntity(Booking booking) => new(
        Id: booking.Id,
        TravelerId: booking.TravelerId,
        TourPackageId: booking.TourPackageId,
        TourPackageName: booking.TourPackage.Name,
        PackageTier: PackageTierDto.FromEntity(booking.PackageTier),
        GroupSize: booking.GroupSize,
        StartDate: booking.StartDate,
        EndDate: booking.EndDate,
        BudgetPerPerson: booking.BudgetPerPerson,
        SpecialRequests: booking.SpecialRequests,
        Status: booking.Status,
        IsLargeGroup: booking.GroupSize > LargeGroupThreshold,
        HasReview: booking.Reviews != null && booking.Reviews.Any());
}
