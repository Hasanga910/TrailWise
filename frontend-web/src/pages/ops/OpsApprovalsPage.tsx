import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Info } from 'lucide-react';
import {
  APPROVAL_TYPES,
  APPROVAL_TYPE_LABELS,
  countForType,
  type ApprovalDecision,
  type ApprovalType,
} from '../../api/approvals';
import { ApprovalCard } from '../../components/ops/approvals/ApprovalCard';
import { DecisionModal } from '../../components/ops/approvals/DecisionModal';
import { DECISION_LABELS } from '../../components/ops/approvals/approvalFormat';
import { Button, EmptyState, PageHeader, Skeleton, Tabs, notify } from '../../components/ui';
import { useApprovalsStore } from '../../stores/approvalsStore';

const isApprovalType = (value: string | null): value is ApprovalType =>
  value !== null && (APPROVAL_TYPES as string[]).includes(value);

/**
 * Approval queue (design doc sections 6 and 8.3): three tabs, evidence per item, and approve /
 * reject / request-revision. `?type=` and `?approval=` make a request linkable (the dashboard uses it).
 */
export function OpsApprovalsPage() {
  const items = useApprovalsStore((s) => s.items);
  const counts = useApprovalsStore((s) => s.counts);
  const loading = useApprovalsStore((s) => s.loading);
  const loaded = useApprovalsStore((s) => s.loaded);
  const error = useApprovalsStore((s) => s.error);
  const deciding = useApprovalsStore((s) => s.deciding);
  const fetchPending = useApprovalsStore((s) => s.fetchPending);
  const decide = useApprovalsStore((s) => s.decide);
  const clearError = useApprovalsStore((s) => s.clearError);

  const [params, setParams] = useSearchParams();
  const [pendingDecision, setPendingDecision] = useState<{ id: string; decision: ApprovalDecision } | null>(null);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const typeParam = params.get('type');
  const approvalParam = params.get('approval');
  const linkedItem = approvalParam ? items.find((i) => i.id === approvalParam) : undefined;

  const activeType: ApprovalType = useMemo(() => {
    if (linkedItem) return linkedItem.type;
    if (isApprovalType(typeParam)) return typeParam;
    if (counts) {
      const firstWithItems = APPROVAL_TYPES.find((t) => countForType(counts, t) > 0);
      if (firstWithItems) return firstWithItems;
    }
    return APPROVAL_TYPES[0];
  }, [linkedItem, typeParam, counts]);

  const visible = useMemo(() => items.filter((i) => i.type === activeType), [items, activeType]);
  const expandedId = linkedItem?.id ?? null;

  useEffect(() => {
    if (!expandedId) return;
    document.querySelector(`[data-approval-id="${expandedId}"]`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [expandedId]);

  const selectTab = useCallback(
    (id: string) => {
      setParams({ type: id }, { replace: true });
    },
    [setParams],
  );

  const toggle = useCallback(
    (id: string) => {
      setParams(expandedId === id ? { type: activeType } : { type: activeType, approval: id }, { replace: true });
    },
    [setParams, expandedId, activeType],
  );

  const decidingItem = pendingDecision ? items.find((i) => i.id === pendingDecision.id) ?? null : null;

  async function submit(note: string) {
    if (!pendingDecision || !decidingItem) return;
    const label = DECISION_LABELS[pendingDecision.decision];
    const ok = await decide(pendingDecision.id, pendingDecision.decision, note || undefined);
    if (ok) {
      notify.success(`${label}: done`, `${decidingItem.booking.tourPackageName} for ${decidingItem.booking.travelerName}`);
      setPendingDecision(null);
      setParams({ type: activeType }, { replace: true });
    } else {
      notify.error('The decision was not saved', useApprovalsStore.getState().error ?? undefined);
    }
  }

  const tabs = APPROVAL_TYPES.map((type) => ({
    id: type,
    label: `${APPROVAL_TYPE_LABELS[type]} (${counts ? countForType(counts, type) : 0})`,
  }));

  const showMissingLink = loaded && approvalParam !== null && !linkedItem;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Approval queue"
        description="Review the evidence and approve, reject or request a revision. A note is required to reject or request a revision."
        actions={
          <Button variant="secondary" onClick={() => void fetchPending()} loading={loading && loaded}>
            Refresh
          </Button>
        }
      />

      {showMissingLink && (
        <p role="status" className="flex items-center gap-2 rounded-card border border-border bg-info-soft px-4 py-3 text-body text-info-fg">
          <Info className="h-4 w-4 shrink-0" aria-hidden /> That request is no longer pending: it may already have been decided.
        </p>
      )}

      {error && loaded && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-body text-danger-fg">
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={() => { clearError(); void fetchPending(); }}>
            Retry
          </Button>
        </div>
      )}

      {!loaded && loading && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading approvals">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loaded && !loading && error && (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-6 text-center text-danger-fg">
          <p className="font-medium">{error}</p>
          <Button className="mt-3" variant="secondary" onClick={() => { clearError(); void fetchPending(); }}>
            Try again
          </Button>
        </div>
      )}

      {loaded && (
        <>
          <Tabs items={tabs} value={activeType} onChange={selectTab} />
          {visible.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-8 w-8" aria-hidden />}
              title="Nothing waiting here"
              description={`There are no pending ${APPROVAL_TYPE_LABELS[activeType].toLowerCase()} requests.`}
            />
          ) : (
            <div className="space-y-3">
              {visible.map((item) => (
                <ApprovalCard
                  key={item.id}
                  item={item}
                  expanded={item.id === expandedId}
                  deciding={deciding.includes(item.id)}
                  onToggle={() => toggle(item.id)}
                  onDecide={(decision) => setPendingDecision({ id: item.id, decision })}
                />
              ))}
            </div>
          )}
        </>
      )}

      <DecisionModal
        item={decidingItem}
        decision={pendingDecision?.decision ?? null}
        submitting={pendingDecision !== null && deciding.includes(pendingDecision.id)}
        onCancel={() => setPendingDecision(null)}
        onSubmit={(note) => void submit(note)}
      />
    </div>
  );
}
