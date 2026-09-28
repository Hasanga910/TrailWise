using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Services;

public record AuditReportResult(
    IReadOnlyList<AuditLog> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages
);

public interface IAuditReportService
{
    Task<AuditReportResult> GetAuditLogsAsync(
        string? entityType,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<byte[]> ExportAuditLogsCsvAsync(
        string? entityType,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken ct = default);
}
