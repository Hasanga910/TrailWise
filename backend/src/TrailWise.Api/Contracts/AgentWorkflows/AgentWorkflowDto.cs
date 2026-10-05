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

// ---- Operations console: workflow monitor (design doc section 6) and section 5 endpoints ----

public record AgentWorkflowRunListItemDto(
    Guid Id,
    Guid BookingId,
    TrailWise.Domain.Enums.BookingStatus BookingStatus,
    string TourPackageName,
    string TravelerName,
    string Objective,
    string Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt,
    int StepsDone,
    int StepsTotal,
    int StepCount,
    long TotalDurationMs);

public record AgentWorkflowStepDetailDto(
    Guid Id,
    string AgentName,
    JsonElement? Input,
    JsonElement? Output,
    JsonElement? ToolCalls,
    string? ValidationResult,
    long DurationMs,
    DateTimeOffset CreatedAt);

public record PendingApprovalRefDto(Guid Id, TrailWise.Domain.Enums.ApprovalType Type);

public record AgentWorkflowRunDetailDto(
    Guid Id,
    Guid BookingId,
    TrailWise.Domain.Enums.BookingStatus BookingStatus,
    string TourPackageName,
    string TravelerName,
    string Objective,
    string Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt,
    JsonElement? Plan,
    int StepsDone,
    int StepsTotal,
    List<AgentWorkflowStepDetailDto> Steps,
    string? SummaryText,
    List<string> AdvisoryFlags,
    bool IsLatestForBooking,
    PendingApprovalRefDto? PendingApproval);

public record ManagerDecisionDto(string Decision, string? Notes, string? NewStatus, DateTimeOffset DecidedAt);

public record AgentWorkflowSummaryStepDto(string AgentName, long DurationMs, string? ValidationResult, int ToolCallCount);

/// <summary>The auditable execution summary (design doc 8.2 step 8).</summary>
public record AgentWorkflowSummaryDto(
    Guid RunId,
    Guid BookingId,
    string Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt,
    long TotalDurationMs,
    int StepCount,
    int ToolCallCount,
    string? ValidationResult,
    ManagerDecisionDto? Decision,
    string? SummaryText,
    List<string> AdvisoryFlags,
    List<AgentWorkflowSummaryStepDto> Steps);

public class StartAgentWorkflowRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    public Guid BookingId { get; set; }
}

public class ApproveAgentWorkflowRequest
{
    [System.ComponentModel.DataAnnotations.MaxLength(500)]
    public string? Note { get; set; }
}
