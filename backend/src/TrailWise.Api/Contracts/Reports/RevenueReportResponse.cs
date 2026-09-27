namespace TrailWise.Api.Contracts.Reports;

public record PackageRevenueDto(
    Guid TourPackageId,
    string PackageName,
    decimal Revenue
);

public record MonthlyRevenueDto(
    int Year,
    int Month,
    string Label,
    decimal Revenue
);

public record RevenueReportResponse(
    decimal TotalRevenue,
    IReadOnlyList<PackageRevenueDto> ByPackage,
    IReadOnlyList<MonthlyRevenueDto> ByMonth
);
