namespace TrailWise.Domain.Entities;

public class AgentStepLog : BaseEntity
{
    public Guid WorkflowRunId { get; set; }
    public AgentWorkflowRun WorkflowRun { get; set; } = null!;

    public string AgentName { get; set; } = string.Empty;
    public string? InputJson { get; set; }
    public string? OutputJson { get; set; }
    public string? ToolCallsJson { get; set; }
    public string? ValidationResult { get; set; }
    public long DurationMs { get; set; }
}
