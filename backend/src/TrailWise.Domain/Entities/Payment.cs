using TrailWise.Domain.Enums;

namespace TrailWise.Domain.Entities;

public class Payment : BaseEntity
{
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;

    public decimal Amount { get; set; }
    public string Method { get; set; } = "BankTransfer";

    /// <summary>
    /// Stores the private relative storage reference for the bank slip file (e.g. "slips/{guid}.jpg").
    /// Note: Named BankSlipUrl for schema and API backwards compatibility, but stores an application-private
    /// storage reference rather than a public static URL or filesystem path.
    /// </summary>
    public string BankSlipUrl { get; set; } = string.Empty;
    public DateTimeOffset SubmittedAt { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public DateTimeOffset? ReviewedAt { get; set; }
    public Guid? ReviewedBy { get; set; }
    public string? RejectionReason { get; set; }
}
