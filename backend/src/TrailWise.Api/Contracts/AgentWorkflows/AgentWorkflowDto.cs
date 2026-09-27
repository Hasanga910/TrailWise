using System.Text.Json;

namespace TrailWise.Api.Contracts.AgentWorkflows;

public record AgentWorkflowStepDto(string AgentName, long DurationMs, JsonElement? Output);

public record AgentWorkflowDto(
    Guid BookingId,
    string Status,
    string? SummaryText,
    List<string> AdvisoryFlags,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt,
    List<AgentWorkflowStepDto> Steps);
