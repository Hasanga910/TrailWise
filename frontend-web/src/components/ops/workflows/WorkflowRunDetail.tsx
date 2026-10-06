import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react';
import {
  getWorkflowSummary,
  type AgentToolCall,
  type AgentWorkflowRunDetailDto,
  type AgentWorkflowStepDetailDto,
  type AgentWorkflowSummaryDto,
} from '../../../api/agentWorkflows';
import { Badge, Button, Skeleton, buttonClasses } from '../../ui';
import {
  RERUNNABLE_BOOKING_STATUSES,
  formatDateTime,
  formatDuration,
  runStatusLabel,
  runStatusTone,
  stringifyJson,
} from './workflowFormat';

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) {
    return <p className="text-caption text-fg-muted">{label}: none recorded</p>;
  }
  return (
    <details className="rounded-input border border-border bg-surface-sunken">
      <summary className="cursor-pointer px-3 py-1.5 text-caption font-medium text-fg">{label}</summary>
      <pre className="max-h-64 overflow-auto px-3 pb-3 text-caption text-fg">{stringifyJson(value)}</pre>
    </details>
  );
}

function ToolCallsTable({ calls }: { calls: AgentToolCall[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-caption">
        <caption className="sr-only">Tool calls</caption>
        <thead>
          <tr className="text-left text-fg-muted">
            <th scope="col" className="py-1 pr-3 font-medium">Tool</th>
            <th scope="col" className="py-1 pr-3 font-medium">Input</th>
            <th scope="col" className="py-1 pr-3 font-medium">Result</th>
            <th scope="col" className="py-1 text-right font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call, index) => (
            <tr key={`${call.tool}-${index}`} className="border-t border-border align-top">
              <td className="py-1 pr-3 font-mono text-fg">
                {call.tool}
                {call.status !== 'ok' && <span className="ml-1 text-danger-fg">(failed)</span>}
              </td>
              <td className="py-1 pr-3 text-fg-muted">{call.input}</td>
              <td className="py-1 pr-3 text-fg-muted">{call.result}</td>
              <td className="py-1 text-right text-fg-muted">{formatDuration(call.durationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepCard({ step, index }: { step: AgentWorkflowStepDetailDto; index: number }) {
  const calls = step.toolCalls ?? [];
  return (
    <li className="rounded-card border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-heading text-body font-semibold text-fg">
          <span className="text-fg-muted">{index + 1}.</span> {step.agentName}
        </h4>
        <span className="flex items-center gap-2 text-caption text-fg-muted">
          {step.validationResult && <Badge tone={step.validationResult === 'Approved' || step.validationResult === 'Valid' ? 'success' : 'warning'}>{step.validationResult}</Badge>}
          {formatDuration(step.durationMs)}
        </span>
      </div>
      <div className="mt-2 space-y-2">
        <div>
          <p className="mb-1 text-overline text-fg-muted">Tool calls</p>
          {calls.length > 0 ? <ToolCallsTable calls={calls} /> : <p className="text-caption text-fg-muted">No tool calls recorded for this step.</p>}
        </div>
        <JsonBlock label="Input" value={step.input} />
        <JsonBlock label="Output" value={step.output} />
      </div>
    </li>
  );
}

export interface WorkflowRunDetailProps {
  run: AgentWorkflowRunDetailDto;
  rerunning: boolean;
  onRerun: () => void;
}

/** The drill-down for one run: plan, steps with tool calls, validation, and the execution summary (doc section 6). */
export function WorkflowRunDetail({ run, rerunning, onRerun }: WorkflowRunDetailProps) {
  const [summary, setSummary] = useState<AgentWorkflowSummaryDto | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getWorkflowSummary(run.id)
      .then((value) => {
        if (!cancelled) {
          setSummary(value);
          setSummaryFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSummaryFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // The summary changes when the run moves on (status) or gains steps.
  }, [run.id, run.status, run.steps.length]);

  const canRerun = run.isLatestForBooking && RERUNNABLE_BOOKING_STATUSES.includes(run.bookingStatus);

  return (
    <div className="space-y-5 p-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-h3 text-fg">{run.tourPackageName}</h3>
          <Badge tone={runStatusTone(run.status)}>{runStatusLabel(run.status)}</Badge>
        </div>
        <p className="text-body text-fg-muted">
          {run.travelerName} · booking {run.bookingStatus} · started {formatDateTime(run.startedAt)}
          {run.completedAt ? `, finished ${formatDateTime(run.completedAt)}` : ''}
        </p>
        <p className="text-body text-fg-muted">{run.objective}</p>
        {!run.isLatestForBooking && (
          <p role="note" className="text-caption text-warning-fg">
            A newer run exists for this booking; this one is kept for the audit trail.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {run.pendingApproval && (
            <Link
              to={`/ops/approvals?type=${run.pendingApproval.type}&approval=${run.pendingApproval.id}`}
              className={buttonClasses('primary', 'sm')}
            >
              Review in approval queue
            </Link>
          )}
          <Link
            to={`/ops/bookings/${run.bookingId}/workflow`}
            className={buttonClasses('secondary', 'sm')}
          >
            Open booking workflow page
          </Link>
          {canRerun && (
            <Button variant="secondary" size="sm" onClick={onRerun} loading={rerunning}>
              Re-run workflow
            </Button>
          )}
        </div>
      </header>

      <section aria-label="Plan">
        <h4 className="mb-2 text-overline text-fg-muted">
          Plan ({run.stepsDone} of {run.stepsTotal} steps done)
        </h4>
        {run.plan && run.plan.steps.length > 0 ? (
          <ol className="space-y-1">
            {run.plan.steps.map((step) => {
              const done = step.status === 'done';
              return (
                <li key={step.step} className="flex items-center gap-2 text-body text-fg">
                  {done ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> : <Circle className="h-4 w-4 text-fg-muted" aria-hidden />}
                  <span className="font-mono text-caption">{step.step}</span>
                  <span className="text-fg-muted">{step.agent}</span>
                  <span className="sr-only">{done ? 'done' : 'pending'}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-body text-fg-muted">No plan was recorded for this run.</p>
        )}
      </section>

      <section aria-label="Execution summary">
        <h4 className="mb-2 text-overline text-fg-muted">Execution summary</h4>
        {summary ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-body sm:grid-cols-4">
            <div><dt className="text-caption text-fg-muted">Steps</dt><dd className="font-medium text-fg">{summary.stepCount}</dd></div>
            <div><dt className="text-caption text-fg-muted">Tool calls</dt><dd className="font-medium text-fg">{summary.toolCallCount}</dd></div>
            <div><dt className="text-caption text-fg-muted">Total time</dt><dd className="font-medium text-fg">{formatDuration(summary.totalDurationMs)}</dd></div>
            <div><dt className="text-caption text-fg-muted">Validation</dt><dd className="font-medium text-fg">{summary.validationResult ?? 'none yet'}</dd></div>
          </dl>
        ) : summaryFailed ? (
          <p role="alert" className="text-body text-danger-fg">The execution summary could not be loaded.</p>
        ) : (
          <Skeleton className="h-10 w-full" />
        )}
        {summary?.decision && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-body text-fg">
            <ShieldCheck className="h-4 w-4 text-brand-fg" aria-hidden />
            Decision: <strong>{summary.decision.decision}</strong>
            {summary.decision.newStatus ? ` (booking now ${summary.decision.newStatus})` : ''}
            {summary.decision.notes ? <span className="text-fg-muted">: “{summary.decision.notes}”</span> : null}
          </p>
        )}
        {(run.summaryText || run.advisoryFlags.length > 0) && (
          <div className="mt-2 space-y-2">
            {run.summaryText && <p className="text-body text-fg">{run.summaryText}</p>}
            {run.advisoryFlags.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {run.advisoryFlags.map((flag) => (
                  <li key={flag}><Badge tone="info">{flag}</Badge></li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section aria-label="Steps">
        <h4 className="mb-2 text-overline text-fg-muted">Steps</h4>
        {run.steps.length === 0 ? (
          <p className="text-body text-fg-muted">No steps have been logged yet.</p>
        ) : (
          <ol className="space-y-2">
            {run.steps.map((step, index) => (
              <StepCard key={step.id} step={step} index={index} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
