namespace TrailWise.Api.Contracts.Reports;

public record PackageOccupancyDto(
    Guid TourPackageId,
    string PackageName,
    int MaxGroupSize,
    int BookingCount,
    int BookedTravelers,
    double AverageGroupSize,
    double OccupancyPercentage
);
