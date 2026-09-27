using System.Text.Json;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class AuditLogService : IAuditLogService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly TrailWiseDbContext _db;
    private readonly ILogger<AuditLogService> _logger;

    public AuditLogService(TrailWiseDbContext db, ILogger<AuditLogService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public Task LogAsync(
        string entityType,
        Guid entityId,
        string action,
        Guid performedBy,
        object? details = null,
        CancellationToken ct = default)
    {
        return LogAsync(entityType, entityId, action, (Guid?)performedBy, details, ct);
    }

    public async Task LogAsync(
        string entityType,
        Guid entityId,
        string action,
        Guid? performedBy,
        object? details = null,
        CancellationToken ct = default)
    {
        string? serializedDetails = details switch
        {
            null => null,
            string s when s.TrimStart().StartsWith('{') || s.TrimStart().StartsWith('[') => s,
            _ => JsonSerializer.Serialize(details, JsonOptions)
        };

        var auditLog = new AuditLog
        {
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            PerformedBy = performedBy,
            Timestamp = DateTimeOffset.UtcNow,
            Details = serializedDetails
        };

        _db.AuditLogs.Add(auditLog);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "AuditLog recorded: EntityType={EntityType}, EntityId={EntityId}, Action={Action}, PerformedBy={PerformedBy}",
            entityType, entityId, action, performedBy);
    }
}
