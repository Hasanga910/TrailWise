import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api/agentWorkflows';
import type { AgentWorkflowRunDetailDto, AgentWorkflowRunListItemDto } from '../api/agentWorkflows';
import { useWorkflowPolling } from '../hooks/useWorkflowPolling';
import { hasActiveRuns, useWorkflowStore } from './workflowStore';

vi.mock('../api/agentWorkflows', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/agentWorkflows')>()),
  listWorkflowRuns: vi.fn(),
  getWorkflowRun: vi.fn(),
  startWorkflow: vi.fn(),
}));

function run(id: string, status: string): AgentWorkflowRunListItemDto {
  return {
    id,
    bookingId: `b-${id}`,
    bookingStatus: 'PendingApproval',
    tourPackageName: 'Hill Country',
    travelerName: 'Pat',
    objective: 'Match a guide',
    status,
    startedAt: '2026-10-05T10:00:00Z',
    completedAt: null,
    stepsDone: 1,
    stepsTotal: 6,
    stepCount: 1,
    totalDurationMs: 5,
  };
}

function detail(id: string, status: string): AgentWorkflowRunDetailDto {
  return {
    id,
    bookingId: `b-${id}`,
    bookingStatus: 'PendingApproval',
    tourPackageName: 'Hill Country',
    travelerName: 'Pat',
    objective: 'Match a guide',
    status,
    startedAt: '2026-10-05T10:00:00Z',
    completedAt: null,
    plan: null,
    stepsDone: 1,
    stepsTotal: 6,
    steps: [],
    summaryText: null,
    advisoryFlags: [],
    isLatestForBooking: true,
    pendingApproval: null,
  };
}

const paged = (items: AgentWorkflowRunListItemDto[]) => ({ items, totalCount: items.length, page: 1, pageSize: 20 });

describe('workflowStore', () => {
  beforeEach(() => {
    useWorkflowStore.getState().reset();
    vi.mocked(api.listWorkflowRuns).mockReset();
    vi.mocked(api.getWorkflowRun).mockReset();
    vi.mocked(api.startWorkflow).mockReset();
  });

  it('loads the runs with the current filter and page', async () => {
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(paged([run('1', 'Completed')]));

    await useWorkflowStore.getState().setStatusFilter('Failed');

    expect(api.listWorkflowRuns).toHaveBeenCalledWith({ status: 'Failed', page: 1, pageSize: 20 });
    expect(useWorkflowStore.getState().runs).toHaveLength(1);
    expect(useWorkflowStore.getState().total).toBe(1);
  });

  it('goes back to the first page when the filter changes', async () => {
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(paged([]));
    await useWorkflowStore.getState().setPage(3);

    await useWorkflowStore.getState().setStatusFilter('Running');

    expect(useWorkflowStore.getState().page).toBe(1);
  });

  it('reports a load error and keeps the previous rows', async () => {
    vi.mocked(api.listWorkflowRuns).mockResolvedValueOnce(paged([run('1', 'Completed')]));
    await useWorkflowStore.getState().fetchRuns();
    vi.mocked(api.listWorkflowRuns).mockRejectedValueOnce(new Error('offline'));

    await useWorkflowStore.getState().fetchRuns();

    expect(useWorkflowStore.getState().error).toBe('Could not load the workflow runs.');
    expect(useWorkflowStore.getState().runs).toHaveLength(1);
  });

  it('a silent refresh does not flip the loading flag', async () => {
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(paged([run('1', 'Running')]));
    const seen: boolean[] = [];
    const unsubscribe = useWorkflowStore.subscribe((s) => seen.push(s.loading));

    await useWorkflowStore.getState().fetchRuns({ silent: true });
    unsubscribe();

    expect(seen).not.toContain(true);
  });

  it('opens a run for the drill-down and closes it again', async () => {
    vi.mocked(api.getWorkflowRun).mockResolvedValue(detail('1', 'Completed'));

    await useWorkflowStore.getState().selectRun('1');
    expect(useWorkflowStore.getState().selectedRun?.id).toBe('1');
    expect(useWorkflowStore.getState().detailLoading).toBe(false);

    await useWorkflowStore.getState().selectRun(null);
    expect(useWorkflowStore.getState().selectedRun).toBeNull();
    expect(useWorkflowStore.getState().selectedRunId).toBeNull();
  });

  it('reports a drill-down error', async () => {
    vi.mocked(api.getWorkflowRun).mockRejectedValue(new Error('gone'));

    await useWorkflowStore.getState().selectRun('1');

    expect(useWorkflowStore.getState().detailError).toBe('Could not load this workflow run.');
  });

  it('ignores a slow response for a run that is no longer selected', async () => {
    let finishFirst: (value: AgentWorkflowRunDetailDto) => void = () => {};
    vi.mocked(api.getWorkflowRun)
      .mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce(detail('2', 'Completed'));

    const first = useWorkflowStore.getState().selectRun('1');
    await useWorkflowStore.getState().selectRun('2');
    finishFirst(detail('1', 'Completed'));
    await first;

    expect(useWorkflowStore.getState().selectedRun?.id).toBe('2');
  });

  it('refreshes the open run while it is still active', async () => {
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(paged([run('1', 'Running')]));
    vi.mocked(api.getWorkflowRun)
      .mockResolvedValueOnce(detail('1', 'Running'))
      .mockResolvedValueOnce(detail('1', 'Completed'));
    await useWorkflowStore.getState().selectRun('1');

    await useWorkflowStore.getState().fetchRuns({ silent: true });

    expect(api.getWorkflowRun).toHaveBeenCalledTimes(2);
    expect(useWorkflowStore.getState().selectedRun?.status).toBe('Completed');
  });

  it('re-runs a workflow and selects the new run', async () => {
    vi.mocked(api.startWorkflow).mockResolvedValue(detail('9', 'AwaitingApproval'));
    vi.mocked(api.getWorkflowRun).mockResolvedValue(detail('9', 'AwaitingApproval')); // refreshed while active
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(paged([run('9', 'AwaitingApproval')]));

    const ok = await useWorkflowStore.getState().rerun('b-1');

    expect(ok).toBe(true);
    expect(api.startWorkflow).toHaveBeenCalledWith('b-1');
    expect(useWorkflowStore.getState().selectedRun?.id).toBe('9');
    expect(useWorkflowStore.getState().runs[0].id).toBe('9');
  });

  it('reports a failed re-run', async () => {
    vi.mocked(api.startWorkflow).mockRejectedValue(new Error('conflict'));

    const ok = await useWorkflowStore.getState().rerun('b-1');

    expect(ok).toBe(false);
    expect(useWorkflowStore.getState().error).toBe('The workflow could not be started.');
  });

  it('hasActiveRuns is true only while something is still moving', () => {
    expect(hasActiveRuns({ runs: [run('1', 'Completed'), run('2', 'Failed')], selectedRun: null })).toBe(false);
    expect(hasActiveRuns({ runs: [run('1', 'Completed'), run('2', 'AwaitingApproval')], selectedRun: null })).toBe(true);
    expect(hasActiveRuns({ runs: [], selectedRun: detail('3', 'Running') })).toBe(true);
  });
});

describe('useWorkflowPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useWorkflowStore.getState().reset();
    vi.mocked(api.listWorkflowRuns).mockReset();
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(paged([run('1', 'Running')]));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setVisibility(state: 'visible' | 'hidden') {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  }

  it('refreshes every interval while a run is active', async () => {
    useWorkflowStore.setState({ runs: [run('1', 'Running')] });
    renderHook(() => useWorkflowPolling(5000));

    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);

    expect(api.listWorkflowRuns).toHaveBeenCalledTimes(2);
  });

  it('does not poll when every run is finished', async () => {
    useWorkflowStore.setState({ runs: [run('1', 'Completed')] });
    renderHook(() => useWorkflowPolling(5000));

    await vi.advanceTimersByTimeAsync(20000);

    expect(api.listWorkflowRuns).not.toHaveBeenCalled();
  });

  it('pauses while the tab is hidden', async () => {
    useWorkflowStore.setState({ runs: [run('1', 'Running')] });
    setVisibility('hidden');
    renderHook(() => useWorkflowPolling(5000));

    await vi.advanceTimersByTimeAsync(20000);

    expect(api.listWorkflowRuns).not.toHaveBeenCalled();
  });

  it('catches up when the tab becomes visible again', async () => {
    useWorkflowStore.setState({ runs: [run('1', 'Running')] });
    setVisibility('visible');
    renderHook(() => useWorkflowPolling(5000));

    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    expect(api.listWorkflowRuns).toHaveBeenCalledTimes(1);
  });

  it('stops polling on unmount', async () => {
    useWorkflowStore.setState({ runs: [run('1', 'Running')] });
    const { unmount } = renderHook(() => useWorkflowPolling(5000));
    unmount();

    await vi.advanceTimersByTimeAsync(20000);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(api.listWorkflowRuns).not.toHaveBeenCalled();
  });
});
