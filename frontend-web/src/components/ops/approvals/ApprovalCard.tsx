import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { APPROVAL_TYPE_LABELS, type ApprovalDecision, type ApprovalItemDto } from '../../../api/approvals';
import { formatDate } from '../../../utils/format';
import { Badge, Button, Card, cn } from '../../ui';
import { ApprovalEvidence } from './ApprovalEvidence';
import { DECISION_LABELS } from './approvalFormat';

export interface ApprovalCardProps {
  item: ApprovalItemDto;
  expanded: boolean;
  deciding: boolean;
  onToggle: () => void;
  onDecide: (decision: ApprovalDecision) => void;
}

const DECISIONS: ApprovalDecision[] = ['Approve', 'RequestRevision', 'Reject'];

export const ApprovalCard = forwardRef<HTMLDivElement, ApprovalCardProps>(function ApprovalCard(
  { item, expanded, deciding, onToggle, onDecide },
  ref,
) {
  const panelId = `approval-panel-${item.id}`;
  const { booking } = item;
  return (
    <Card ref={ref} padded={false} data-approval-id={item.id} aria-label={`${APPROVAL_TYPE_LABELS[item.type]}: ${booking.tourPackageName}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 rounded-card px-5 py-4 text-left transition hover:bg-surface-sunken"
      >
        <span className="min-w-0">
          <span className="block truncate font-heading text-h4 text-fg">{booking.tourPackageName}</span>
          <span className="mt-0.5 block text-body text-fg-muted">
            {booking.travelerName} · group of {booking.groupSize} · {formatDate(booking.startDate)} to {formatDate(booking.endDate)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {item.type === 'RefundException' && item.refund && (
            <Badge tone="warning">Starts in {item.refund.daysUntilStart} day(s)</Badge>
          )}
          <span className="text-caption text-fg-muted">Requested {formatDate(item.requestedAt)}</span>
          <ChevronDown className={cn('h-5 w-5 text-fg-muted transition', expanded && 'rotate-180')} aria-hidden />
        </span>
      </button>

      {expanded && (
        <div id={panelId} className="space-y-4 border-t border-border px-5 py-4">
          <ApprovalEvidence item={item} />
          <div className="flex flex-wrap justify-end gap-2">
            {DECISIONS.map((decision) => (
              <Button
                key={decision}
                variant={decision === 'Approve' ? 'primary' : decision === 'Reject' ? 'danger' : 'secondary'}
                disabled={deciding}
                onClick={() => onDecide(decision)}
              >
                {DECISION_LABELS[decision]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
});
