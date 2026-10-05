import { create } from 'zustand';
import { extractErrorMessage } from '../api/apiClient';
import {
  ACTIVE_WORKFLOW_STATUSES,
  getWorkflowRun,
  listWorkflowRuns,
  startWorkflow,
  type AgentWorkflowRunDetailDto,
  type AgentWorkflowRunListItemDto,
} from '../api/agentWorkflows';

export const WORKFLOW_POLL_INTERVAL_MS = 5000;
const PAGE_SIZE = 20;

/** Agent workflow monitor state (design doc section 6): the run list, filters, and the run drill-down. */
interface WorkflowState {
  runs: AgentWorkflowRunListItemDto[];
  total: number;
  page: number;
  /** Empty string means all statuses. */
  statusFilter: string;
  loading: boolean;
  error: string | null;

  selectedRunId: string | null;
  selectedRun: AgentWorkflowRunDetailDto | null;
  detailLoading: boolean;
  detailError: string | null;

  fetchRuns: (options?: { silent?: boolean }) => Promise<void>;
  setStatusFilter: (status: string) => Promise<void>;
  setPage: (page: number) => Promise<void>;
  selectRun: (runId: string | null) => Promise<void>;
  /** Re-runs the workflow for a booking; the new run is selected. Resolves true on success. */
  rerun: (bookingId: string) => Promise<boolean>;
  reset: () => void;
}

const initialState = {
  runs: [] as AgentWorkflowRunListItemDto[],
  total: 0,
  page: 1,
  statusFilter: '',
  loading: false,
  error: null as string | null,
  selectedRunId: null as string | null,
  selectedRun: null as AgentWorkflowRunDetailDto | null,
  detailLoading: false,
  detailError: null as string | null,
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  ...initialState,

  // `silent` refreshes (polling) keep the current rows on screen instead of flashing a loading state.
  async fetchRuns({ silent = false } = {}) {
    if (!silent) {
      set({ loading: true });
    }
    try {
      const { statusFilter, page } = get();
      const result = await listWorkflowRuns({ status: statusFilter, page, pageSize: PAGE_SIZE });
      set({ runs: result.items, total: result.totalCount, loading: false, error: null });

      const { selectedRunId, selectedRun } = get();
      if (selectedRunId && selectedRun && ACTIVE_WORKFLOW_STATUSES.includes(selectedRun.status)) {
        await get().selectRun(selectedRunId);
      }
    } catch (err) {
      set({ loading: false, error: extractErrorMessage(err, 'Could not load the workflow runs.') });
    }
  },

  async setStatusFilter(status) {
    set({ statusFilter: status, page: 1 });
    await get().fetchRuns();
  },

  async setPage(page) {
    set({ page: Math.max(1, page) });
    await get().fetchRuns();
  },

  async selectRun(runId) {
    if (runId === null) {
      set({ selectedRunId: null, selectedRun: null, detailError: null, detailLoading: false });
      return;
    }

    const isRefresh = get().selectedRunId === runId && get().selectedRun !== null;
    set({ selectedRunId: runId, detailLoading: !isRefresh, detailError: null });
    try {
      const detail = await getWorkflowRun(runId);
      if (get().selectedRunId === runId) {
        set({ selectedRun: detail, detailLoading: false });
      }
    } catch (err) {
      if (get().selectedRunId === runId) {
        set({ detailLoading: false, detailError: extractErrorMessage(err, 'Could not load this workflow run.') });
      }
    }
  },

  async rerun(bookingId) {
    try {
      const run = await startWorkflow(bookingId);
      set({ error: null, selectedRunId: run.id, selectedRun: run, detailError: null });
      await get().fetchRuns({ silent: true });
      return true;
    } catch (err) {
      set({ error: extractErrorMessage(err, 'The workflow could not be started.') });
      return false;
    }
  },

  reset() {
    set({ ...initialState });
  },
}));

/** True while any listed run (or the open run) is still moving, so polling is worthwhile. */
export function hasActiveRuns(state: Pick<WorkflowState, 'runs' | 'selectedRun'>): boolean {
  return (
    state.runs.some((run) => ACTIVE_WORKFLOW_STATUSES.includes(run.status)) ||
    (state.selectedRun !== null && ACTIVE_WORKFLOW_STATUSES.includes(state.selectedRun.status))
  );
}
