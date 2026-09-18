namespace TrailWise.Infrastructure.Services;

public sealed class AgentWorkflowPlan
{
    public List<AgentWorkflowPlanStep> Steps { get; set; } = new();
}

public sealed class AgentWorkflowPlanStep
{
    public string Step { get; set; } = string.Empty;
    public string Agent { get; set; } = string.Empty;
    public string Status { get; set; } = PlanStepStatus.Pending;
}

internal static class PlanStepStatus
{
    public const string Pending = "pending";
    public const string Done = "done";
}
