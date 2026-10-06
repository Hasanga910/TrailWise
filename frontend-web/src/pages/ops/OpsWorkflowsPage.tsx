import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { WORKFLOW_STATUSES, type AgentWorkflowRunListItemDto } from '../../api/agentWorkflows';
import { WorkflowRunDetail } from '../../components/ops/workflows/WorkflowRunDetail';
import {
  formatDateTime,
  formatDuration,
  runStatusLabel,
  runStatusTone,
} from '../../components/ops/workflows/workflowFormat';
import { Badge, Button, DataTable, Drawer, Modal, PageHeader, Select, Skeleton, notify, type Column } from '../../components/ui';
import { useWorkflowPolling } from '../../hooks/useWorkflowPolling';
import { WORKFLOW_POLL_INTERVAL_MS, hasActiveRuns, useWorkflowStore } from '../../stores/workflowStore';

const PAGE_SIZE = 20;

/**
 * Agent workflow monitor (design doc section 6): live status of each run, with a drill-down into the
 * plan, steps, tool calls, validation and execution summary. `?run=<id>` opens a run directly.
 */
export function OpsWorkflowsPage() {
  const runs = useWorkflowStore((s) => s.runs);
  const total = useWorkflowStore((s) => s.total);
  const page = useWorkflowStore((s) => s.page);
  const statusFilter = useWorkflowStore((s) => s.statusFilter);
  const loading = useWorkflowStore((s) => s.loading);
  const error = useWorkflowStore((s) => s.error);
  const selectedRunId = useWorkflowStore((s) => s.selectedRunId);
  const selectedRun = useWorkflowStore((s) => s.selectedRun);
  const detailLoading = useWorkflowStore((s) => s.detailLoading);
  const detailError = useWorkflowStore((s) => s.detailError);
  const fetchRuns = useWorkflowStore((s) => s.fetchRuns);
  const setStatusFilter = useWorkflowStore((s) => s.setStatusFilter);
  const setPage = useWorkflowStore((s) => s.setPage);
  const selectRun = useWorkflowStore((s) => s.selectRun);
  const rerun = useWorkflowStore((s) => s.rerun);
  const reset = useWorkflowStore((s) => s.reset);

  const [params, setParams] = useSearchParams();
  const [confirmingRerun, setConfirmingRerun] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  useWorkflowPolling();

  const runParam = params.get('run');
  useEffect(() => {
    void fetchRuns().finally(() => setFirstLoadDone(true));
    return reset;
  }, [fetchRuns, reset]);

  useEffect(() => {
    if (runParam && runParam !== useWorkflowStore.getState().selectedRunId) {
      void selectRun(runParam);
    }
  }, [runParam, selectRun]);

  const live = hasActiveRuns({ runs, selectedRun });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openRun(id: string) {
    setParams({ run: id }, { replace: true });
    void selectRun(id);
  }

  function closeRun() {
    setParams({}, { replace: true });
    void selectRun(null);
  }

  async function confirmRerun() {
    if (!selectedRun) return;
    setRerunning(true);
    const ok = await rerun(selectedRun.bookingId);
    setRerunning(false);
    setConfirmingRerun(false);
    if (ok) {
      notify.success('Workflow re-run', 'A new run was recorded for this booking.');
      const id = useWorkflowStore.getState().selectedRunId;
      if (id) setParams({ run: id }, { replace: true });
    } else {
      notify.error('The workflow could not be started', useWorkflowStore.getState().error ?? undefined);
    }
  }

  const columns: Column<AgentWorkflowRunListItemDto>[] = [
    {
      key: 'booking',
      header: 'Booking',
      cell: (r) => (
        <span>
          <span className="block font-medium text-fg">{r.tourPackageName}</span>
          <span className="block text-caption text-fg-muted">{r.travelerName} · {r.bookingStatus}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge tone={runStatusTone(r.status)}>{runStatusLabel(r.status)}</Badge>,
    },
    {
      key: 'progress',
      header: 'Progress',
      cell: (r) => (
        <span className="flex items-center gap-2">
          <progress
            max={Math.max(1, r.stepsTotal)}
            value={r.stepsDone}
            aria-label={`${r.stepsDone} of ${r.stepsTotal} plan steps done`}
            className="h-2 w-20 overflow-hidden rounded-full accent-brand-600"
          />
          <span className="text-caption text-fg-muted">{r.stepsDone}/{r.stepsTotal}</span>
        </span>
      ),
    },
    {
      key: 'time',
      header: 'Steps / time',
      cell: (r) => <span className="text-fg-muted">{r.stepCount} · {formatDuration(r.totalDurationMs)}</span>,
    },
    { key: 'started', header: 'Started', cell: (r) => <span className="text-fg-muted">{formatDateTime(r.startedAt)}</span> },
    {
      key: 'view',
      header: 'Details',
      cell: (r) => (
        <Button size="sm" variant="secondary" onClick={() => openRun(r.id)} aria-label={`View run for ${r.tourPackageName}`}>
          View
        </Button>
      ),
    },
  ];

  const initialLoading = !firstLoadDone && loading;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Agent workflows"
        description="Every run of the coordinator: its plan, each agent step, tool calls, validation and execution summary."
        actions={
          <Button variant="secondary" onClick={() => void fetchRuns()} loading={loading && firstLoadDone}>
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Select
          label="Status"
          value={statusFilter}
          onChange={(e) => void setStatusFilter(e.target.value)}
          wrapperClassName="w-56"
        >
          <option value="">All statuses</option>
          {WORKFLOW_STATUSES.map((status) => (
            <option key={status} value={status}>{runStatusLabel(status)}</option>
          ))}
        </Select>
        <p role="status" className="flex items-center gap-2 text-caption text-fg-muted">
          <Activity className={`h-4 w-4 ${live ? 'text-info' : ''}`} aria-hidden />
          {live
            ? `Live: refreshing every ${WORKFLOW_POLL_INTERVAL_MS / 1000} s while runs are active`
            : 'All runs on this page are finished'}
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-body text-danger-fg">
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={() => void fetchRuns()}>Retry</Button>
        </div>
      )}

      {initialLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading workflow runs">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <>
          <DataTable
            caption="Workflow runs"
            columns={columns}
            rows={runs}
            rowKey={(r) => r.id}
            pageSize={PAGE_SIZE}
            emptyTitle="No workflow runs"
            emptyDescription={statusFilter ? `There are no ${runStatusLabel(statusFilter).toLowerCase()} runs.` : 'Runs appear here when a booking request is processed.'}
          />
          {total > PAGE_SIZE && (
            <nav aria-label="Workflow runs pages" className="flex items-center justify-between text-body text-fg-muted">
              <span>Page {page} of {pageCount} ({total} runs)</span>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => void setPage(page - 1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => void setPage(page + 1)}>Next</Button>
              </span>
            </nav>
          )}
        </>
      )}

      <Drawer open={selectedRunId !== null} onClose={closeRun} title="Workflow run" className="w-[min(46rem,100vw)]">
        {detailLoading && !selectedRun && (
          <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading run">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {detailError && (
          <div role="alert" className="m-5 rounded-card border border-danger/30 bg-danger-soft p-4 text-body text-danger-fg">
            {detailError}
          </div>
        )}
        {selectedRun && selectedRun.id === selectedRunId && (
          <WorkflowRunDetail run={selectedRun} rerunning={rerunning} onRerun={() => setConfirmingRerun(true)} />
        )}
      </Drawer>

      <Modal
        open={confirmingRerun}
        onClose={() => (rerunning ? undefined : setConfirmingRerun(false))}
        title="Re-run this workflow?"
        description="A new run is recorded for the booking. The earlier run stays in the audit trail."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingRerun(false)} disabled={rerunning}>Cancel</Button>
            <Button onClick={() => void confirmRerun()} loading={rerunning}>Re-run workflow</Button>
          </>
        }
      >
        <p className="text-body text-fg-muted">
          The agents match a guide, check the fleet, price the trip and validate it again. A booking that now passes
          the rules is confirmed automatically; otherwise it goes to the approval queue or manual review.
        </p>
      </Modal>
    </div>
  );
}
