namespace TrailWise.Domain.Entities;

public class GuideAvailability : BaseEntity
{
    public Guid GuideId { get; set; }
    public Guide Guide { get; set; } = null!;

    public DateOnly Date { get; set; }
    public bool IsAvailable { get; set; } = true;

    public Guid? AssignedBookingId { get; set; }
    public Booking? AssignedBooking { get; set; }
}
