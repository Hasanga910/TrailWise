namespace TrailWise.Api.Contracts.Reports;

public class GetAuditLogsQuery
{
    public string? EntityType { get; init; }
    public DateTimeOffset? From { get; init; }
    public DateTimeOffset? To { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}
