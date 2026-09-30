using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Payments;

public class RejectPaymentRequest
{
    [Required(ErrorMessage = "Rejection reason is required.")]
    [MaxLength(500, ErrorMessage = "Rejection reason cannot exceed 500 characters.")]
    public string Reason { get; set; } = string.Empty;
}
