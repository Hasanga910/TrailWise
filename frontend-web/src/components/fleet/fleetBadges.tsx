import type { VehicleMaintenanceStatus, VehicleType } from '../../api/vehicles';
import { Badge, cn, type BadgeTone } from '../ui';

const MAINTENANCE_META: Record<string, { tone: BadgeTone; label: string; dot: string; pulse?: boolean }> = {
  Available: { tone: 'success', label: 'Available', dot: 'bg-success' },
  UnderMaintenance: { tone: 'warning', label: 'Under Maintenance', dot: 'bg-warning', pulse: true },
  OutOfService: { tone: 'danger', label: 'Out of Service', dot: 'bg-danger' },
};

export function StatusBadge({ status }: { status: VehicleMaintenanceStatus }) {
  const meta = MAINTENANCE_META[status];
  if (!meta) return <Badge>{status}</Badge>;
  return (
    <Badge tone={meta.tone} className="gap-1.5">
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot, meta.pulse && 'animate-pulse')} aria-hidden />
      {meta.label}
    </Badge>
  );
}

const VEHICLE_TYPE_TONES: Record<VehicleType, BadgeTone> = {
  Van: 'brand',
  Coach: 'info',
  SUV: 'warning',
};

export function VehicleTypeBadge({ type }: { type: VehicleType }) {
  return <Badge tone={VEHICLE_TYPE_TONES[type] ?? 'neutral'}>{type}</Badge>;
}

const BOOKING_STATUS_META: Record<string, { tone: BadgeTone; label: string }> = {
  NeedsManualReview: { tone: 'danger', label: 'Needs Review' },
  PlanProposed: { tone: 'info', label: '✨ Plan Proposed' },
  PendingApproval: { tone: 'warning', label: 'Pending Approval' },
  Requested: { tone: 'info', label: 'Requested' },
  Confirmed: { tone: 'success', label: 'Confirmed' },
};

export function BookingStatusBadge({ status }: { status: string }) {
  const meta = BOOKING_STATUS_META[status];
  if (!meta) return <Badge>{status}</Badge>;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
