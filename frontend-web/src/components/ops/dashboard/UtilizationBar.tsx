import { cn } from '../../ui';

export function UtilizationBar({ label, percentage, detail, muted }: { label: string; percentage: number; detail?: string; muted?: boolean }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    <li className={cn('space-y-1', muted && 'opacity-70')}>
      <div className="flex items-baseline justify-between gap-3 text-body">
        <span className="min-w-0 truncate font-medium text-fg">{label}</span>
        <span className="shrink-0 text-fg-muted">
          {detail ? `${detail} · ` : ''}
          {Math.round(clamped)}%
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label} utilisation`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${clamped}%` }} />
      </div>
    </li>
  );
}
