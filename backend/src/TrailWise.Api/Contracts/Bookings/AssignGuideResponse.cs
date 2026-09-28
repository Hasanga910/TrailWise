using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Bookings;

public record AssignGuideResponse(
    Guid BookingId,
    Guid GuideId,
    BookingStatus Status);
