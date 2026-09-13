using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Packages;

public record TourPackageDto(
    Guid Id,
    string Name,
    string Theme,
    int DurationDays,
    decimal BasePricePerPerson,
    int MaxGroupSize,
    IReadOnlyList<PackageTierDto> Tiers)
{
    public static TourPackageDto FromEntity(TourPackage package) => new(
        package.Id,
        package.Name,
        package.Theme,
        package.DurationDays,
        package.BasePricePerPerson,
        package.MaxGroupSize,
        package.PackageTiers.Select(PackageTierDto.FromEntity).ToList());
}
