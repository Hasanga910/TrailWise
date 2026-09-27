using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Discounts;

public class CreateDiscountRequest
{
    [Required]
    [MaxLength(200)]
    public string Description { get; set; } = string.Empty;

    [Range(0.01, 100)]
    public decimal PercentageOff { get; set; }

    [Range(1, int.MaxValue)]
    public int MinGroupSize { get; set; }
}
