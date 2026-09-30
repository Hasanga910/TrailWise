using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Infrastructure.Services;

public class BookingLifecycleService : IBookingLifecycleService
{
    private readonly IClock _clock;

    public BookingLifecycleService(IClock clock)
    {
        _clock = clock;
    }

    public bool TransitionToConfirmed(Booking booking)
    {
        if (booking.Status == BookingStatus.Confirmed)
        {
            return false;
        }

        booking.Status = BookingStatus.Confirmed;
        booking.PaymentDueAt ??= _clock.UtcNow.AddHours(1);
        return true;
    }
}
