using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Packages;

public record PackageLocationDto(Guid Id, string Name, double? Latitude = null, double? Longitude = null)
{
    public static PackageLocationDto FromEntity(PackageLocation location) =>
        new(location.Id, location.Name, location.Latitude, location.Longitude);
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
    IReadOnlyList<PackageLocationDto> Locations,
    double AverageRating = 0.0,
    int ReviewCount = 0,
    decimal StartingPrice = 0)
{
    public static TourPackageDto FromEntity(TourPackage package, double averageRating = 0.0, int reviewCount = 0) => new(
        package.Id,
        package.Name,
        package.Theme,
        package.DurationDays,
        package.BasePricePerPerson,
        package.MaxGroupSize,
        package.PhotoUrl,
        package.PackageTiers.Select(PackageTierDto.FromEntity).ToList(),
        package.Locations.Select(PackageLocationDto.FromEntity).ToList(),
        averageRating,
        reviewCount,
        StartingPriceOf(package));

    /// <summary>Lowest tier price, or the package base price when it has no tiers.</summary>
    public static decimal StartingPriceOf(TourPackage package) =>
        package.PackageTiers.Count > 0 ? package.PackageTiers.Min(t => t.BasePricePerPerson) : package.BasePricePerPerson;
}
