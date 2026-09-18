namespace TrailWise.Infrastructure.Services;

public interface ICoordinatorAgentService
{
    Task StartWorkflowAsync(Guid bookingId, CancellationToken ct = default);
}
