import { AlertTriangle, CheckCircle2, Clock, Flag, Hourglass, Sparkles, XCircle, type LucideIcon } from 'lucide-react';
import type { BookingStatus } from '../../api/bookings';
import type { BadgeTone } from './badgeStyles';

export const STATUS_META: Record<BookingStatus, { tone: BadgeTone; icon: LucideIcon; label: string }> = {
  Requested: { tone: 'info', icon: Clock, label: 'Requested' },
  PlanProposed: { tone: 'info', icon: Sparkles, label: 'Plan Proposed' },
  PendingApproval: { tone: 'warning', icon: Hourglass, label: 'Pending Approval' },
  NeedsManualReview: { tone: 'orange', icon: AlertTriangle, label: 'Needs Manual Review' },
  Confirmed: { tone: 'brand', icon: CheckCircle2, label: 'Confirmed' },
  Completed: { tone: 'success', icon: Flag, label: 'Completed' },
  Cancelled: { tone: 'neutral', icon: XCircle, label: 'Cancelled' },
};

