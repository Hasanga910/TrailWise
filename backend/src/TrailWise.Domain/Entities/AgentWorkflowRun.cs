namespace TrailWise.Domain.Entities;

public class AgentWorkflowRun : BaseEntity
{
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;

    public string Objective { get; set; } = string.Empty;
    public string? PlanJson { get; set; }
    public string Status { get; set; } = "Started";
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }

    public ICollection<AgentStepLog> StepLogs { get; set; } = new List<AgentStepLog>();
}
