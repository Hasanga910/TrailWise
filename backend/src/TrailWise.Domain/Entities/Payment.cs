using TrailWise.Domain.Enums;

namespace TrailWise.Domain.Entities;

public class Payment : BaseEntity
{
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;

    public decimal Amount { get; set; }
    public string Method { get; set; } = string.Empty;
    public DateTimeOffset? PaidAt { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
}
