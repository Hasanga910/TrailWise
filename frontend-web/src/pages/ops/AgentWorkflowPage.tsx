import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { extractErrorMessage } from '../../api/apiClient';
import { getAgentWorkflow, type AgentWorkflowDto } from '../../api/agentWorkflows';
import { decideBooking, getBookingById, type BookingDto } from '../../api/bookings';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Skeleton, Textarea } from '../../components/ui';
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
      <div className="mb-2">
        <Link to="/ops/bookings" className="text-body font-semibold text-brand-text hover:underline">
          &larr; Back to bookings
        </Link>
      </div>
      <PageHeader title="Agent Workflow" description="How the coordinator agent processed this booking." />

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-card border border-border bg-surface-raised" />
          ))}
        </div>
      )}

      {!loading && notFound && (
        <Card padded={false} className="border-dashed">
          <EmptyState title="No agent activity recorded for this booking yet." />
        </Card>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft px-4 py-3">
          <p className="text-body font-medium text-danger-fg">{error}</p>
          <Button variant="secondary" size="sm" className="mt-3 border-danger/30 text-danger-fg" onClick={load}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !notFound && !error && workflow && (
        <div className="space-y-6">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-h4 text-fg">Summary</h3>
              <Badge className="whitespace-nowrap">{workflow.status}</Badge>
            </div>
            {workflow.summaryText ? (
              <p className="text-body text-fg">{workflow.summaryText}</p>
            ) : (
              <p className="text-body italic text-fg-muted">Summary not available yet.</p>
            )}
            {workflow.advisoryFlags.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-body text-fg-muted">
                {workflow.advisoryFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            )}

            {(canApprove || canReject) && (
              <div className="mt-4 flex gap-2 border-t border-border pt-4">
                {canApprove && (
                  <Button size="sm" disabled={deciding} onClick={handleApprove}>
                    Approve
                  </Button>
                )}
                {canReject && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="border-danger/30 text-danger-fg"
                    disabled={deciding}
                    onClick={() => setShowRejectPrompt(true)}
                  >
                    Reject
                  </Button>
                )}
              </div>
            )}
          </Card>

          <section>
            <h3 className="mb-3 font-heading text-h4 text-fg">Step timeline</h3>
            <div className="space-y-3">
              {workflow.steps.map((step, index) => (
                <Card key={`${step.agentName}-${index}`} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-fg">{step.agentName}</p>
                    <span className="text-caption text-fg-muted">{formatDuration(step.durationMs)}</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-caption font-semibold text-brand-text hover:underline">
                      View output
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-input bg-surface-sunken p-3 text-caption text-fg">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  </details>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}

      <Modal
        open={showRejectPrompt}
        onClose={() => setShowRejectPrompt(false)}
        size="sm"
        title="Reject booking"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRejectPrompt(false)}>
              Back
            </Button>
            <Button type="submit" form="workflow-reject-form" variant="danger" loading={deciding}>
              Reject
            </Button>
          </>
        }
      >
        <form id="workflow-reject-form" onSubmit={handleRejectSubmit}>
          <Textarea
            id="workflow-reject-notes"
            label="Notes (optional)"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
          />
        </form>
      </Modal>
    </div>
  );
}
