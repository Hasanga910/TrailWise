using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Reports;

public record AuditLogDto(
    Guid Id,
    string EntityType,
    Guid EntityId,
    string Action,
    Guid? PerformedBy,
    DateTimeOffset Timestamp,
    string? Details
)
{
    public static AuditLogDto FromEntity(AuditLog log) => new(
        log.Id,
        log.EntityType,
        log.EntityId,
        log.Action,
        log.PerformedBy,
        log.Timestamp,
        log.Details
    );
}
