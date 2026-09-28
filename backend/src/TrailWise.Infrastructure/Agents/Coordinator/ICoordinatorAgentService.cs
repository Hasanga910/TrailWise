namespace TrailWise.Infrastructure.Agents;

public interface ICoordinatorAgentService
{
    Task StartWorkflowAsync(Guid bookingId, CancellationToken ct = default);
}
