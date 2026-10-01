using TrailWise.Domain.Enums;

namespace TrailWise.Domain.Entities;

public static class BookingStatusTransitions
{
    public static bool CanDecide(BookingStatus current) =>
        current is BookingStatus.PendingApproval or BookingStatus.NeedsManualReview or BookingStatus.PlanProposed;

    public static bool CanApprove(BookingStatus current, bool hasAssignedGuide) =>
        current switch
        {
            BookingStatus.PendingApproval or BookingStatus.PlanProposed => true,
            BookingStatus.NeedsManualReview => hasAssignedGuide,
            _ => false
        };

    public static bool CanComplete(BookingStatus current) =>
        current is BookingStatus.Confirmed;

    public static bool CanCancel(BookingStatus current) =>
        current is BookingStatus.Requested or BookingStatus.PlanProposed
            or BookingStatus.PendingApproval or BookingStatus.NeedsManualReview
            or BookingStatus.Confirmed;
}
