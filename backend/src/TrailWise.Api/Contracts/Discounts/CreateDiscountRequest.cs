using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Discounts;

public class CreateDiscountRequest
{
    [Required(ErrorMessage = "Description is required.")]
    [MaxLength(200, ErrorMessage = "Description cannot exceed 200 characters.")]
    public string Description { get; set; } = string.Empty;

    [Range(0.0001, 100.0, ErrorMessage = "PercentageOff must be greater than 0 and less than or equal to 100.")]
    public decimal PercentageOff { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "MinGroupSize must be at least 1.")]
    public int MinGroupSize { get; set; }
}
