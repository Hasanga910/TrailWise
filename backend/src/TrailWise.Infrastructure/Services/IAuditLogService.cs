namespace TrailWise.Infrastructure.Services;

public interface IAuditLogService
{
    Task LogAsync(
        string entityType,
        Guid entityId,
        string action,
        Guid performedBy,
        object? details = null,
        CancellationToken ct = default);

    Task LogAsync(
        string entityType,
        Guid entityId,
        string action,
        Guid? performedBy,
        object? details = null,
        CancellationToken ct = default);
}
