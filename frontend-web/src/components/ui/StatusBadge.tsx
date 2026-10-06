import type { BookingStatus } from '../../api/bookings';
import { Badge } from './Badge';
import { STATUS_META } from './statusMeta';

export function StatusBadge({ status, label, className }: { status: BookingStatus; label?: string; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone} className={className}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label ?? meta.label}
    </Badge>
  );
}
