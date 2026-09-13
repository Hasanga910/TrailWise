namespace TrailWise.Domain.Entities;

public class BookingAddOn : BaseEntity
{
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;

    public string Description { get; set; } = string.Empty;
    public decimal Cost { get; set; }
}
