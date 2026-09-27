import { apiClient } from './apiClient';

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
