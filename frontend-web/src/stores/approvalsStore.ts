import { create } from 'zustand';
import { extractErrorMessage } from '../api/apiClient';
import {
  decideApproval,
  getPendingApprovals,
  type ApprovalCountsDto,
  type ApprovalDecision,
  type ApprovalItemDto,
} from '../api/approvals';

/**
 * Approval queue state shared by the approvals page and the Ops navigation badge
 * (design doc section 6: Zustand for booking/approval state, see docs/adr/0002).
 */
interface ApprovalsState {
  items: ApprovalItemDto[];
  counts: ApprovalCountsDto | null;
  loading: boolean;
  /** Set after the first successful load, so the page can tell "empty" from "not loaded yet". */
  loaded: boolean;
  error: string | null;
  /** Approval ids with a decision in flight (disables their buttons). */
  deciding: string[];

  fetchPending: () => Promise<void>;
  /** Resolves true when the decision was saved; on failure `error` is set and false is returned. */
  decide: (id: string, decision: ApprovalDecision, note?: string) => Promise<boolean>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  items: [] as ApprovalItemDto[],
  counts: null as ApprovalCountsDto | null,
  loading: false,
  loaded: false,
  error: null as string | null,
  deciding: [] as string[],
};

export const useApprovalsStore = create<ApprovalsState>((set, get) => ({
  ...initialState,

  async fetchPending() {
    set({ loading: true, error: null });
    try {
      const data = await getPendingApprovals();
      set({ items: data.items, counts: data.counts, loading: false, loaded: true });
    } catch (err) {
      set({ loading: false, error: extractErrorMessage(err, 'Could not load the approval queue.') });
    }
  },

  async decide(id, decision, note) {
    if (get().deciding.includes(id)) {
      return false;
    }

    set((state) => ({ deciding: [...state.deciding, id], error: null }));
    try {
      await decideApproval(id, decision, note);
      // The decided item leaves the queue; counts come from the server so they cannot drift.
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
      await get().fetchPending();
      return true;
    } catch (err) {
      set({ error: extractErrorMessage(err, 'The decision could not be saved.') });
      return false;
    } finally {
      set((state) => ({ deciding: state.deciding.filter((x) => x !== id) }));
    }
  },

  clearError() {
    set({ error: null });
  },

  reset() {
    set({ ...initialState });
  },
}));

/** Number of approvals waiting, or null before the first load (for the navigation badge). */
export const selectPendingTotal = (state: ApprovalsState): number | null => state.counts?.total ?? null;
