using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class BookingNotificationService : IBookingNotificationService
{
    private readonly TrailWiseDbContext _db;
    private readonly ISmsService _smsService;
    private readonly ILogger<BookingNotificationService> _logger;

    public BookingNotificationService(
        TrailWiseDbContext db,
        ISmsService smsService,
        ILogger<BookingNotificationService> logger)
    {
        _db = db;
        _smsService = smsService;
        _logger = logger;
    }

    public async Task SendBookingConfirmedNotificationsAsync(Guid bookingId, CancellationToken ct = default)
    {
        try
        {
            var booking = await _db.Bookings
                .AsNoTracking()
                .Include(b => b.Traveler)
                .Include(b => b.TourPackage)
                .Include(b => b.VehicleAssignments)
                    .ThenInclude(va => va.Vehicle)
                .Include(b => b.VehicleAssignments)
                    .ThenInclude(va => va.Driver)
                        .ThenInclude(d => d.User)
                .Include(b => b.GuideAvailabilities)
                    .ThenInclude(ga => ga.Guide)
                        .ThenInclude(g => g.User)
                .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

            if (booking is null)
            {
                _logger.LogWarning("Cannot send confirmation SMS: Booking {BookingId} not found.", bookingId);
                return;
            }

            var packageName = booking.TourPackage?.Name ?? "Tour Package";
            var startDateStr = booking.StartDate.ToString("yyyy-MM-dd");
            var endDateStr = booking.EndDate.ToString("yyyy-MM-dd");
            var tourDates = $"{startDateStr} to {endDateStr}";

            // Traveler details
            var travelerName = booking.Traveler?.Name ?? "Traveler";
            var travelerPhone = booking.Traveler?.ContactNumber ?? string.Empty;

            // Vehicle & Driver details (from first active VehicleAssignment)
            var vehicleAssignment = booking.VehicleAssignments.FirstOrDefault();
            var vehicleType = vehicleAssignment?.Vehicle?.Type.ToString() ?? "Standard Vehicle";
            var vehicleRegNumber = vehicleAssignment?.Vehicle?.RegistrationNumber ?? "Pending";
            var driverName = vehicleAssignment?.Driver?.Name ?? "Pending Driver";
            var driverPhone = !string.IsNullOrWhiteSpace(vehicleAssignment?.Driver?.ContactInfo)
                ? vehicleAssignment.Driver.ContactInfo
                : vehicleAssignment?.Driver?.User?.ContactNumber ?? "N/A";

            // Guide details (from first GuideAvailability assigned to this booking)
            var guideAvailability = booking.GuideAvailabilities.FirstOrDefault(ga => ga.AssignedBookingId == booking.Id)
                ?? booking.GuideAvailabilities.FirstOrDefault();
            var guideName = guideAvailability?.Guide?.Name ?? "Pending Guide";
            var guidePhone = !string.IsNullOrWhiteSpace(guideAvailability?.Guide?.ContactInfo)
                ? guideAvailability.Guide.ContactInfo
                : guideAvailability?.Guide?.User?.ContactNumber ?? "N/A";

            // Send SMS ONLY to the Traveler (single page, <= 160 characters)
            if (!string.IsNullOrWhiteSpace(travelerPhone))
            {
                var vehicleInfo = vehicleRegNumber != "Pending" ? $" {vehicleRegNumber}" : "";
                var driverInfo = driverName != "Pending Driver" ? $" Driver:{driverName}" : "";
                
                // Keep concise to guarantee 1 SMS credit (< 160 chars):
                // e.g.: "TrailWise: Booking confirmed for Cultural Triangle (2026-10-11 to 2026-10-12). Veh: WP-REG-1234. Driver: Sunil. Have a safe tour!"
                var travelerMessage = $"TrailWise: Booking confirmed for {packageName} ({tourDates})." +
                    (!string.IsNullOrEmpty(vehicleInfo) ? $" Veh:{vehicleInfo}." : "") +
                    (!string.IsNullOrEmpty(driverInfo) ? $"{driverInfo}." : "") +
                    " Have a safe tour!";

                // Ensure it never exceeds standard 160-character single-part SMS limit
                if (travelerMessage.Length > 160)
                {
                    travelerMessage = travelerMessage.Substring(0, 157) + "...";
                }

                await _smsService.SendSmsAsync(travelerPhone, travelerMessage);
            }
            else
            {
                _logger.LogInformation("Traveler phone number not available for booking {BookingId}; skipped traveler SMS.", bookingId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send booking confirmed SMS notifications for Booking {BookingId}", bookingId);
        }
    }
}
