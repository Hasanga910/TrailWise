using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Discounts;

public class CreateDiscountRequest : IValidatableObject
{
    [Required(ErrorMessage = "Description is required.")]
    [MaxLength(200, ErrorMessage = "Description cannot exceed 200 characters.")]
    public string Description { get; set; } = string.Empty;

    [Range(0.0001, 100.0, ErrorMessage = "PercentageOff must be greater than 0 and at most 100.")]
    public decimal PercentageOff { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "MinGroupSize must be at least 1.")]
    public int MinGroupSize { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset? ValidFrom { get; set; }

    public DateTimeOffset? ValidUntil { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ValidFrom.HasValue && ValidUntil.HasValue && ValidUntil.Value < ValidFrom.Value)
        {
            yield return new ValidationResult(
                "ValidUntil must be greater than or equal to ValidFrom.",
                new[] { nameof(ValidUntil) });
        }
    }
}
