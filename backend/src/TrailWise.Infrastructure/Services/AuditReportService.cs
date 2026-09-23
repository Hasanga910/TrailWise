using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class AuditReportService : IAuditReportService
{
    private readonly TrailWiseDbContext _db;
    private readonly ILogger<AuditReportService> _logger;

    public AuditReportService(TrailWiseDbContext db, ILogger<AuditReportService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<AuditReportResult> GetAuditLogsAsync(
        string? entityType,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _db.AuditLogs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(entityType))
        {
            var normalized = entityType.Trim().ToLower();
            query = query.Where(a => a.EntityType.ToLower() == normalized);
        }

        if (from.HasValue)
        {
            query = query.Where(a => a.Timestamp >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(a => a.Timestamp <= to.Value);
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling((double)totalCount / pageSize);

        _logger.LogInformation(
            "Retrieved {Count} audit log items for page {Page} (TotalCount={TotalCount}, TotalPages={TotalPages})",
            items.Count, page, totalCount, totalPages);

        return new AuditReportResult(items, page, pageSize, totalCount, totalPages);
    }

    public async Task<byte[]> ExportAuditLogsCsvAsync(
        string? entityType,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken ct = default)
    {
        var query = _db.AuditLogs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(entityType))
        {
            var normalized = entityType.Trim().ToLower();
            query = query.Where(a => a.EntityType.ToLower() == normalized);
        }

        if (from.HasValue)
        {
            query = query.Where(a => a.Timestamp >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(a => a.Timestamp <= to.Value);
        }

        var logs = await query
            .OrderByDescending(a => a.Timestamp)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("Timestamp,EntityType,EntityId,Action,PerformedBy,Details");

        foreach (var log in logs)
        {
            var timestampStr = log.Timestamp.ToString("O");
            var entityTypeStr = EscapeCsv(log.EntityType);
            var entityIdStr = log.EntityId.ToString();
            var actionStr = EscapeCsv(log.Action);
            var performedByStr = log.PerformedBy.HasValue ? log.PerformedBy.Value.ToString() : string.Empty;
            var detailsStr = EscapeCsv(log.Details);

            sb.Append(timestampStr).Append(',')
              .Append(entityTypeStr).Append(',')
              .Append(entityIdStr).Append(',')
              .Append(actionStr).Append(',')
              .Append(performedByStr).Append(',')
              .AppendLine(detailsStr);
        }

        _logger.LogInformation("Exported {Count} audit log items to CSV", logs.Count);

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var containsSpecialChars = value.Contains(',') ||
                                   value.Contains('"') ||
                                   value.Contains('\r') ||
                                   value.Contains('\n');

        if (containsSpecialChars)
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }
}
