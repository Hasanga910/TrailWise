import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api/approvals';
import type { ApprovalItemDto, PendingApprovalsDto } from '../api/approvals';
import { selectPendingTotal, useApprovalsStore } from './approvalsStore';

vi.mock('../api/approvals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/approvals')>()),
  getPendingApprovals: vi.fn(),
  decideApproval: vi.fn(),
}));

function item(id: string, type: ApprovalItemDto['type']): ApprovalItemDto {
  return {
    id,
    type,
    status: 'Pending',
    bookingId: `b-${id}`,
    requestedAt: '2026-10-05T10:00:00Z',
    reasons: [],
    booking: {
      travelerName: 'Pat',
      tourPackageName: 'Hill Country',
      classType: 'Normal',
      includesFood: false,
      requiresAc: false,
      groupSize: 12,
      startDate: '2026-11-01',
      endDate: '2026-11-04',
      budgetPerPerson: 100,
      specialRequests: null,
      languagePreference: null,
    },
    evidence: { guide: null, vehicle: null, pricing: null, validation: null, summaryText: null, advisoryFlags: [] },
    workflowRunId: null,
    refund: null,
  };
}

function pending(items: ApprovalItemDto[]): PendingApprovalsDto {
  const count = (t: ApprovalItemDto['type']) => items.filter((i) => i.type === t).length;
  return {
    items,
    counts: {
      largeGroupOrCustomItinerary: count('LargeGroupOrCustomItinerary'),
      budgetOverride: count('BudgetOverride'),
      refundException: count('RefundException'),
      total: items.length,
    },
  };
}

describe('approvalsStore', () => {
  beforeEach(() => {
    useApprovalsStore.getState().reset();
    vi.mocked(api.getPendingApprovals).mockReset();
    vi.mocked(api.decideApproval).mockReset();
  });

  it('starts empty and not loaded, with no badge count', () => {
    const state = useApprovalsStore.getState();

    expect(state.items).toEqual([]);
    expect(state.loaded).toBe(false);
    expect(selectPendingTotal(state)).toBeNull();
  });

  it('loads the queue and its counts', async () => {
    vi.mocked(api.getPendingApprovals).mockResolvedValue(
      pending([item('1', 'BudgetOverride'), item('2', 'RefundException'), item('3', 'RefundException')]),
    );

    await useApprovalsStore.getState().fetchPending();

    const state = useApprovalsStore.getState();
    expect(state.items).toHaveLength(3);
    expect(state.counts?.refundException).toBe(2);
    expect(selectPendingTotal(state)).toBe(3);
    expect(state.loaded).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('keeps the previous queue and reports an error when loading fails', async () => {
    vi.mocked(api.getPendingApprovals).mockResolvedValueOnce(pending([item('1', 'BudgetOverride')]));
    await useApprovalsStore.getState().fetchPending();
    vi.mocked(api.getPendingApprovals).mockRejectedValueOnce(new Error('offline'));

    await useApprovalsStore.getState().fetchPending();

    const state = useApprovalsStore.getState();
    expect(state.error).toBe('Could not load the approval queue.');
    expect(state.items).toHaveLength(1);
    expect(state.loading).toBe(false);
  });

  it('removes a decided item and refreshes the counts from the server', async () => {
    vi.mocked(api.getPendingApprovals)
      .mockResolvedValueOnce(pending([item('1', 'BudgetOverride'), item('2', 'BudgetOverride')]))
      .mockResolvedValueOnce(pending([item('2', 'BudgetOverride')]));
    vi.mocked(api.decideApproval).mockResolvedValue({ id: '1', status: 'Approved', booking: {} as never });
    await useApprovalsStore.getState().fetchPending();

    const ok = await useApprovalsStore.getState().decide('1', 'Approve');

    expect(ok).toBe(true);
    expect(api.decideApproval).toHaveBeenCalledWith('1', 'Approve', undefined);
    const state = useApprovalsStore.getState();
    expect(state.items.map((i) => i.id)).toEqual(['2']);
    expect(selectPendingTotal(state)).toBe(1);
    expect(state.deciding).toEqual([]);
  });

  it('passes the note through for a rejection or revision', async () => {
    vi.mocked(api.getPendingApprovals).mockResolvedValue(pending([]));
    vi.mocked(api.decideApproval).mockResolvedValue({ id: '1', status: 'Rejected', booking: {} as never });

    await useApprovalsStore.getState().decide('1', 'Reject', 'Outside policy');

    expect(api.decideApproval).toHaveBeenCalledWith('1', 'Reject', 'Outside policy');
  });

  it('keeps the item and surfaces the error when a decision fails', async () => {
    vi.mocked(api.getPendingApprovals).mockResolvedValue(pending([item('1', 'BudgetOverride')]));
    vi.mocked(api.decideApproval).mockRejectedValue(new Error('conflict'));
    await useApprovalsStore.getState().fetchPending();

    const ok = await useApprovalsStore.getState().decide('1', 'Approve');

    expect(ok).toBe(false);
    const state = useApprovalsStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.error).toBe('The decision could not be saved.');
    expect(state.deciding).toEqual([]);
    state.clearError();
    expect(useApprovalsStore.getState().error).toBeNull();
  });

  it('ignores a second decision on an item whose decision is still in flight', async () => {
    vi.mocked(api.getPendingApprovals).mockResolvedValue(pending([item('1', 'BudgetOverride')]));
    let finish: (value: Awaited<ReturnType<typeof api.decideApproval>>) => void = () => {};
    vi.mocked(api.decideApproval).mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const first = useApprovalsStore.getState().decide('1', 'Approve');
    const second = await useApprovalsStore.getState().decide('1', 'Approve');
    finish({ id: '1', status: 'Approved', booking: {} as never });
    await first;

    expect(second).toBe(false);
    expect(api.decideApproval).toHaveBeenCalledTimes(1);
  });

  it('reset returns to the initial state', async () => {
    vi.mocked(api.getPendingApprovals).mockResolvedValue(pending([item('1', 'BudgetOverride')]));
    await useApprovalsStore.getState().fetchPending();

    useApprovalsStore.getState().reset();

    expect(useApprovalsStore.getState().items).toEqual([]);
    expect(useApprovalsStore.getState().loaded).toBe(false);
  });
});
