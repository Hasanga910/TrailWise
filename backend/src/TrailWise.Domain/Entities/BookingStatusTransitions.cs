using TrailWise.Domain.Enums;

namespace TrailWise.Domain.Entities;

public static class BookingStatusTransitions
{
    public static bool CanDecide(BookingStatus current) =>
        current is BookingStatus.PendingApproval or BookingStatus.NeedsManualReview;

    public static bool CanComplete(BookingStatus current) =>
        current is BookingStatus.Confirmed;

    public static bool CanCancel(BookingStatus current) =>
        current is BookingStatus.Requested or BookingStatus.PlanProposed
            or BookingStatus.PendingApproval or BookingStatus.NeedsManualReview
            or BookingStatus.Confirmed;
}
