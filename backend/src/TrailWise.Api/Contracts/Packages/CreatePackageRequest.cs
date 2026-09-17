using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Packages;

public class CreatePackageRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Theme { get; set; } = string.Empty;

    [Range(1, 365)]
    public int DurationDays { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal BasePricePerPerson { get; set; }

    [Range(1, int.MaxValue)]
    public int MaxGroupSize { get; set; }

    [Required, MinLength(1)]
    public List<CreatePackageTierRequest> Tiers { get; set; } = new();

    [Required, MinLength(1)]
    public List<string> LocationNames { get; set; } = new();
}
