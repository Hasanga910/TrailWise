using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Packages;

public record PackageLocationDto(Guid Id, string Name)
{
    public static PackageLocationDto FromEntity(PackageLocation location) => new(location.Id, location.Name);
}

public record TourPackageDto(
    Guid Id,
    string Name,
    string Theme,
    int DurationDays,
    decimal BasePricePerPerson,
    int MaxGroupSize,
    string? PhotoUrl,
    IReadOnlyList<PackageTierDto> Tiers,
    IReadOnlyList<PackageLocationDto> Locations)
{
    public static TourPackageDto FromEntity(TourPackage package) => new(
        package.Id,
        package.Name,
        package.Theme,
        package.DurationDays,
        package.BasePricePerPerson,
        package.MaxGroupSize,
        package.PhotoUrl,
        package.PackageTiers.Select(PackageTierDto.FromEntity).ToList(),
        package.Locations.Select(PackageLocationDto.FromEntity).ToList());
}
