using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Services;

public interface IBookingLifecycleService
{
    bool TransitionToConfirmed(Booking booking);
}
