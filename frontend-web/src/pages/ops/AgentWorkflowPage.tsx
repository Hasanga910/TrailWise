import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { extractErrorMessage } from '../../api/apiClient';
import { getAgentWorkflow, type AgentWorkflowDto } from '../../api/agentWorkflows';

function formatDuration(durationMs: number): string {
  return durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
}

export function AgentWorkflowPage() {
  const { bookingId } = useParams<{ bookingId: string }>();

  const [workflow, setWorkflow] = useState<AgentWorkflowDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!bookingId) {
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    getAgentWorkflow(bookingId)
      .then((data) => setWorkflow(data))
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

  return (
    <div>
      <div className="mb-6">
        <Link to="/ops/bookings" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          &larr; Back to bookings
        </Link>
        <h2 className="mt-2 font-heading text-xl font-bold text-slate-900">Agent Workflow</h2>
        <p className="mt-1 text-sm text-slate-500">
          How the coordinator agent processed this booking.
        </p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      )}

      {!loading && notFound && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-600">No agent activity recorded for this booking yet.</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !notFound && !error && workflow && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-base font-bold text-slate-900">Summary</h3>
              <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {workflow.status}
              </span>
            </div>
            {workflow.summaryText ? (
              <p className="text-sm text-slate-700">{workflow.summaryText}</p>
            ) : (
              <p className="text-sm italic text-slate-400">Summary not available yet.</p>
            )}
            {workflow.advisoryFlags.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {workflow.advisoryFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-3 font-heading text-base font-bold text-slate-900">Step timeline</h3>
            <div className="space-y-3">
              {workflow.steps.map((step, index) => (
                <div key={`${step.agentName}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{step.agentName}</p>
                    <span className="text-xs text-slate-400">{formatDuration(step.durationMs)}</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-600 hover:text-brand-700">
                      View output
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
