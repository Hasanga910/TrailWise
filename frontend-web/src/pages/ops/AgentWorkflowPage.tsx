import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { extractErrorMessage } from '../../api/apiClient';
import { getAgentWorkflow, type AgentWorkflowDto } from '../../api/agentWorkflows';
import { decideBooking, getBookingById, type BookingDto } from '../../api/bookings';
import { notify } from '../../components/ui/notify';

function formatDuration(durationMs: number): string {
  return durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
}

export function AgentWorkflowPage() {
  const { bookingId } = useParams<{ bookingId: string }>();

  const [workflow, setWorkflow] = useState<AgentWorkflowDto | null>(null);
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(() => {
    if (!bookingId) {
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    Promise.all([getAgentWorkflow(bookingId), getBookingById(bookingId)])
      .then(([workflowData, bookingData]) => {
        setWorkflow(workflowData);
        setBooking(bookingData);
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setNotFound(true);
        } else {
          setError(extractErrorMessage(err, 'Could not load this booking’s agent workflow.'));
        }
      })
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove() {
    if (!bookingId) return;
    setDeciding(true);
    try {
      await decideBooking(bookingId, { decision: 'Approve' });
      load();
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Could not approve this booking.'));
    } finally {
      setDeciding(false);
    }
  }

  async function handleRejectSubmit(e: FormEvent) {
    e.preventDefault();
    if (!bookingId) return;
    setDeciding(true);
    try {
      await decideBooking(bookingId, { decision: 'Reject', notes: rejectNotes || undefined });
      setShowRejectPrompt(false);
      setRejectNotes('');
      load();
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Could not reject this booking.'));
    } finally {
      setDeciding(false);
    }
  }

  const canApprove =
    booking?.status === 'PendingApproval' ||
    booking?.status === 'PlanProposed';
  const canReject =
    booking?.status === 'PendingApproval' ||
    booking?.status === 'NeedsManualReview' ||
    booking?.status === 'PlanProposed';

  return (
    <div>
      <div className="mb-6">
        <Link to="/ops/bookings" className="text-sm font-semibold text-brand-text hover:text-brand-text">
          &larr; Back to bookings
        </Link>
        <h2 className="mt-2 font-heading text-xl font-bold text-fg">Agent Workflow</h2>
        <p className="mt-1 text-sm text-fg-muted">
          How the coordinator agent processed this booking.
        </p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface-raised" />
          ))}
        </div>
      )}

      {!loading && notFound && (
        <div className="rounded-xl border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
          <p className="font-medium text-fg-muted">No agent activity recorded for this booking yet.</p>
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3">
          <p className="text-sm font-medium text-danger-fg">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-lg border border-danger/30 px-3 py-1.5 text-sm font-semibold text-danger-fg transition hover:bg-danger-soft"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !notFound && !error && workflow && (
        <div className="space-y-6">

          <section className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-base font-bold text-fg">Summary</h3>
              <span className="whitespace-nowrap rounded-full bg-neutral-soft px-2.5 py-0.5 text-xs font-semibold text-fg-muted">
                {workflow.status}
              </span>
            </div>
            {workflow.summaryText ? (
              <p className="text-sm text-fg">{workflow.summaryText}</p>
            ) : (
              <p className="text-sm italic text-fg-muted">Summary not available yet.</p>
            )}
            {workflow.advisoryFlags.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-fg-muted">
                {workflow.advisoryFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            )}

            {(canApprove || canReject) && (
              <div className="mt-4 flex gap-2 border-t border-border pt-4">
                {canApprove && (
                  <button
                    type="button"
                    disabled={deciding}
                    onClick={handleApprove}
                    className="rounded-lg border border-success/30 px-3 py-1.5 text-sm font-semibold text-success-fg transition hover:bg-success-soft disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {canReject && (
                  <button
                    type="button"
                    disabled={deciding}
                    onClick={() => setShowRejectPrompt(true)}
                    className="rounded-lg border border-danger/30 px-3 py-1.5 text-sm font-semibold text-danger-fg transition hover:bg-danger-soft disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 font-heading text-base font-bold text-fg">Step timeline</h3>
            <div className="space-y-3">
              {workflow.steps.map((step, index) => (
                <div key={`${step.agentName}-${index}`} className="rounded-xl border border-border bg-surface-raised p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-fg">{step.agentName}</p>
                    <span className="text-xs text-fg-muted">{formatDuration(step.durationMs)}</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-text hover:text-brand-text">
                      View output
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-sunken p-3 text-xs text-fg">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {showRejectPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-surface-raised p-6 shadow-lg">
            <h3 className="font-heading text-base font-bold text-fg">Reject booking</h3>
            <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="workflow-reject-notes" className="mb-1 block text-sm font-medium text-fg">
                  Notes (optional)
                </label>
                <textarea
                  id="workflow-reject-notes"
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectPrompt(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-fg transition hover:bg-surface-sunken"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={deciding}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
