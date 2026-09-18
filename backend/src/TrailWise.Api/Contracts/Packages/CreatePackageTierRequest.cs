using System.ComponentModel.DataAnnotations;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Packages;

public class CreatePackageTierRequest
{
    [Required]
    public ClassType ClassType { get; set; }

    public bool IncludesFood { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal BasePricePerPerson { get; set; }

    public bool RequiresAC { get; set; }
}
