namespace TrailWise.Infrastructure.Services;

public interface IBookingNotificationService
{
    Task SendBookingConfirmedNotificationsAsync(Guid bookingId, CancellationToken ct = default);
}
