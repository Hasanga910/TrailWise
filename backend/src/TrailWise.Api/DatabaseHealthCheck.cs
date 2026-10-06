using Microsoft.Extensions.Diagnostics.HealthChecks;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api;

/// <summary>Reports unhealthy when the database cannot be reached. Details are never written to the response.</summary>
public sealed class DatabaseHealthCheck(TrailWiseDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            return await db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Database is unreachable.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Database check failed.", ex);
        }
    }
}
