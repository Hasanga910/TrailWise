using TrailWise.Domain.Enums;

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

public record VehicleUtilizationResult(
    Guid VehicleId,
    string RegistrationNumber,
    VehicleType Type,
    VehicleMaintenanceStatus MaintenanceStatus,
    int BookedDays,
    int WindowDays,
    double UtilizationPercentage
);

public record GuideUtilizationResult(
    Guid GuideId,
    string GuideName,
    int AssignedDays,
    int AvailableDays,
    int RecordedDays,
    double UtilizationPercentage,
    int WindowDays
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

    /// <summary>
    /// Days each vehicle is reserved for a non-cancelled booking inside [from, to], as a share of the
    /// days in that window.
    /// </summary>
    Task<IReadOnlyList<VehicleUtilizationResult>> GetVehicleUtilizationReportAsync(
        DateOnly from,
        DateOnly to,
        CancellationToken ct = default);

    /// <summary>
    /// Days each guide is assigned to a booking inside [from, to], as a share of the days in that window.
    /// A day with no availability row counts as available. <c>RecordedDays</c> is kept for older clients
    /// and equals <c>WindowDays</c>.
    /// </summary>
    Task<IReadOnlyList<GuideUtilizationResult>> GetGuideUtilizationReportAsync(
        DateOnly from,
        DateOnly to,
        CancellationToken ct = default);
}
