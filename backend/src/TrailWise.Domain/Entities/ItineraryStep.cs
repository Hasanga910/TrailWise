namespace TrailWise.Domain.Entities;

public class ItineraryStep : BaseEntity
{
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;

    public int DayNumber { get; set; }
    public string Activity { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public TimeOnly StartTime { get; set; }
}
