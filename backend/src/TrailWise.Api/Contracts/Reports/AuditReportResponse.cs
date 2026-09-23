namespace TrailWise.Api.Contracts.Reports;

public record AuditReportResponse(
    IReadOnlyList<AuditLogDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages
);
