import type { BadgeTone } from '../../ui';

export const RUN_STATUS_TONE: Record<string, BadgeTone> = {
  Started: 'neutral',
  Running: 'info',
  AwaitingApproval: 'warning',
  Completed: 'success',
  Failed: 'danger',
};

export const RUN_STATUS_LABEL: Record<string, string> = {
  Started: 'Started',
  Running: 'Running',
  AwaitingApproval: 'Awaiting approval',
  Completed: 'Completed',
  Failed: 'Failed',
};

export const runStatusTone = (status: string): BadgeTone => RUN_STATUS_TONE[status] ?? 'neutral';
export const runStatusLabel = (status: string): string => RUN_STATUS_LABEL[status] ?? status;

/** Human friendly step timing: "12 ms", "1.4 s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Steps a manager can re-run from the monitor: the booking is waiting for a (new) workflow run. */
export const RERUNNABLE_BOOKING_STATUSES = ['Requested', 'NeedsManualReview'];

export function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return String(value);
  }
}
