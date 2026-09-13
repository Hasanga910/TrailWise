using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Packages;

public record PackageTierDto(Guid Id, ClassType ClassType, bool IncludesFood, decimal BasePricePerPerson, bool RequiresAC)
{
    public static PackageTierDto FromEntity(PackageTier tier) =>
        new(tier.Id, tier.ClassType, tier.IncludesFood, tier.BasePricePerPerson, tier.RequiresAC);
}
