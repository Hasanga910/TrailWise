import { apiClient } from './apiClient';
import type { ApprovalType, PagedResult } from './bookings';

export interface AgentWorkflowStepDto {
  agentName: string;
  durationMs: number;
  output: unknown;
}

export interface AgentWorkflowDto {
  bookingId: string;
  status: string;
  summaryText: string | null;
  advisoryFlags: string[];
  startedAt: string;
  completedAt: string | null;
  steps: AgentWorkflowStepDto[];
}

export async function getAgentWorkflow(bookingId: string): Promise<AgentWorkflowDto> {
  const response = await apiClient.get<AgentWorkflowDto>(`/api/agent-workflows/${bookingId}`);
  return response.data;
}

// ---- Workflow monitor (design doc section 6) ----

export type WorkflowRunStatus = 'Started' | 'Running' | 'AwaitingApproval' | 'Completed' | 'Failed';
export const WORKFLOW_STATUSES: WorkflowRunStatus[] = ['Running', 'AwaitingApproval', 'Completed', 'Failed'];

/** Runs in these statuses are still moving, so the monitor polls while any is on screen. */
export const ACTIVE_WORKFLOW_STATUSES: readonly string[] = ['Started', 'Running', 'AwaitingApproval'];

export interface AgentWorkflowRunListItemDto {
  id: string;
  bookingId: string;
  bookingStatus: string;
  tourPackageName: string;
  travelerName: string;
  objective: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  stepsDone: number;
  stepsTotal: number;
  stepCount: number;
  totalDurationMs: number;
}

export interface AgentToolCall {
  tool: string;
  input: string;
  result: string;
  status: 'ok' | 'error' | string;
  durationMs: number;
}

export interface AgentWorkflowStepDetailDto {
  id: string;
  agentName: string;
  input: unknown;
  output: unknown;
  toolCalls: AgentToolCall[] | null;
  validationResult: string | null;
  durationMs: number;
  createdAt: string;
}

export interface WorkflowPlanStep {
  step: string;
  agent: string;
  status: string;
}

export interface AgentWorkflowRunDetailDto {
  id: string;
  bookingId: string;
  bookingStatus: string;
  tourPackageName: string;
  travelerName: string;
  objective: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  plan: { steps: WorkflowPlanStep[] } | null;
  stepsDone: number;
  stepsTotal: number;
  steps: AgentWorkflowStepDetailDto[];
  summaryText: string | null;
  advisoryFlags: string[];
  isLatestForBooking: boolean;
  pendingApproval: { id: string; type: ApprovalType } | null;
}

export interface AgentWorkflowSummaryDto {
  runId: string;
  bookingId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  totalDurationMs: number;
  stepCount: number;
  toolCallCount: number;
  validationResult: string | null;
  decision: { decision: string; notes: string | null; newStatus: string | null; decidedAt: string } | null;
  summaryText: string | null;
  advisoryFlags: string[];
  steps: { agentName: string; durationMs: number; validationResult: string | null; toolCallCount: number }[];
}

export interface ListWorkflowRunsParams {
  status?: string;
  bookingId?: string;
  page?: number;
  pageSize?: number;
}

export async function listWorkflowRuns(params: ListWorkflowRunsParams = {}): Promise<PagedResult<AgentWorkflowRunListItemDto>> {
  const response = await apiClient.get<PagedResult<AgentWorkflowRunListItemDto>>('/api/agent-workflows', {
    params: { ...params, status: params.status || undefined },
  });
  return response.data;
}

export async function getWorkflowRun(runId: string): Promise<AgentWorkflowRunDetailDto> {
  const response = await apiClient.get<AgentWorkflowRunDetailDto>(`/api/agent-workflows/runs/${runId}`);
  return response.data;
}

export async function getWorkflowSummary(runId: string): Promise<AgentWorkflowSummaryDto> {
  const response = await apiClient.get<AgentWorkflowSummaryDto>(`/api/agent-workflows/${runId}/summary`);
  return response.data;
}

/** Re-runs the workflow for a booking that is Requested or NeedsManualReview. */
export async function startWorkflow(bookingId: string): Promise<AgentWorkflowRunDetailDto> {
  const response = await apiClient.post<AgentWorkflowRunDetailDto>('/api/agent-workflows/start', { bookingId });
  return response.data;
}
