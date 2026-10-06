import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from './Card';
import { cn } from './cn';

function useCountUp(target: number, durationMs = 600): number {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduced]);
  return reduced ? target : value;
}

export interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  /** Percentage change; positive is shown as an increase. */
  delta?: number;
  hint?: string;
  format?: (n: number) => string;
  className?: string;
}

export function StatCard({ label, value, icon, delta, hint, format, className }: StatCardProps) {
  const numeric = typeof value === 'number' ? value : 0;
  const animated = useCountUp(numeric);
  const display =
    typeof value === 'number' ? (format ?? ((n: number) => Math.round(n).toLocaleString()))(animated) : value;
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-overline text-fg-muted">{label}</p>
        {icon && <span className="text-brand-600 dark:text-brand-400">{icon}</span>}
      </div>
      <p className="mt-2 font-heading text-h1 text-fg">{display}</p>
      <div className="mt-1 flex items-center gap-2 text-caption">
        {delta !== undefined && (
          <span className={cn('inline-flex items-center font-semibold', delta >= 0 ? 'text-success' : 'text-danger')}>
            {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
            {Math.abs(delta)}%
          </span>
        )}
        {hint && <span className="text-fg-muted">{hint}</span>}
      </div>
    </Card>
  );
}
