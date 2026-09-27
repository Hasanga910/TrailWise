using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Payments;

public class CreatePaymentRequest
{
    [Required]
    public Guid BookingId { get; set; }

    [Range(0.01, double.MaxValue, ErrorMessage = "Payment amount must be greater than 0.")]
    public decimal Amount { get; set; }

    [Required]
    public string Method { get; set; } = string.Empty;
}
