import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { DashboardRefundExceptionDto } from '../../../api/reports';
import { formatDate } from '../../../utils/format';
import { Badge, buttonClasses } from '../../ui';
import { refundLink, startsInText } from './dashboardFormat';

/**
 * Pending cancellation / refund requests whose tour starts within the urgent window. Shown with a
 * label and icon as well as colour, and each links straight to the request in the approval queue.
 */
export function UrgentRefunds({ items, withinDays }: { items: DashboardRefundExceptionDto[]; withinDays: number }) {
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Urgent cancellation requests"
      className="rounded-card border border-danger/40 bg-danger-soft p-4 text-danger-fg"
    >
      <h3 className="flex items-center gap-2 font-heading text-h4">
        <AlertTriangle className="h-5 w-5" aria-hidden />
        Urgent: {items.length} cancellation {items.length === 1 ? 'request needs' : 'requests need'} a decision
      </h3>
      <p className="mt-1 text-body">These tours start within {withinDays} days (or already have).</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.approvalId} className="flex flex-wrap items-center justify-between gap-3 rounded-input bg-surface-raised px-3 py-2 text-fg">
            <span className="min-w-0">
              <span className="block truncate font-medium">{item.tourPackageName}</span>
              <span className="block text-caption text-fg-muted">
                {item.travelerName} · {formatDate(item.startDate)}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <Badge tone="danger">Urgent: {startsInText(item.daysUntilStart)}</Badge>
              <Link to={refundLink(item)} className={buttonClasses('primary', 'sm')} aria-label={`Review cancellation for ${item.tourPackageName}`}>
                Review
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
