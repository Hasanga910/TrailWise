namespace TrailWise.Infrastructure.Services;

public record PackageOccupancyResult(
    Guid TourPackageId,
    string PackageName,
    int MaxGroupSize,
    int BookingCount,
    int BookedTravelers,
    double AverageGroupSize,
    double OccupancyPercentage
);

public record PackageRevenueResult(
    Guid TourPackageId,
    string PackageName,
    decimal Revenue
);

public record MonthlyRevenueResult(
    int Year,
    int Month,
    string Label,
    decimal Revenue
);

public record RevenueReportResult(
    decimal TotalRevenue,
    IReadOnlyList<PackageRevenueResult> ByPackage,
    IReadOnlyList<MonthlyRevenueResult> ByMonth
);

public record GuideUtilizationResult(
    Guid GuideId,
    string GuideName,
    int AssignedDays,
    int AvailableDays,
    int RecordedDays,
    double UtilizationPercentage
);

public interface IOperationsReportService
{
    Task<IReadOnlyList<PackageOccupancyResult>> GetOccupancyReportAsync(
        DateOnly from,
        DateOnly to,
        CancellationToken ct = default);

    Task<RevenueReportResult> GetRevenueReportAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct = default);

    Task<IReadOnlyList<GuideUtilizationResult>> GetGuideUtilizationReportAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct = default);
}
