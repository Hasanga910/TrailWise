namespace TrailWise.Api.Contracts.Reports;

public class ExportAuditLogsQuery
{
    public string? EntityType { get; init; }
    public DateTimeOffset? From { get; init; }
    public DateTimeOffset? To { get; init; }
}
