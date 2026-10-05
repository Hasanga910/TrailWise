import type { BookingDto } from '../../api/bookings';
import { BookingsIcon } from '../admin/icons';
import { Card, EmptyState, Skeleton, Tabs, cn } from '../ui';
import { BookingStatusBadge } from './fleetBadges';

export type QueueTab = 'NeedsManualReview';

interface AllocationQueueProps {
  bookings: BookingDto[];
  loading: boolean;
  selectedId?: string;
  onSelect: (booking: BookingDto) => void;
}

/** Left column of the fleet workspace: bookings waiting on transport that need manual review. */
export function AllocationQueue({ bookings, loading, selectedId, onSelect }: AllocationQueueProps) {
  const needsReviewBookings = bookings.filter((b) => b.status === 'NeedsManualReview');

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookingsIcon className="h-5 w-5 text-brand-text" />
          <h2 className="font-heading text-h4 text-fg">Allocation Queue</h2>
        </div>
        <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-caption font-bold text-rose-600 dark:text-rose-400">
          {needsReviewBookings.length} Needs Review
        </span>
      </div>

      <div className="rounded-card border border-rose-500/20 bg-rose-500/5 p-2.5 text-caption text-rose-700 dark:text-rose-300">
        <span className="font-semibold">⚠️ Action Required:</span> Bookings where AI resource matching encountered conflicts or shortages.
      </div>

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Loading queue">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
          <span className="sr-only">Loading queue...</span>
        </div>
      ) : needsReviewBookings.length === 0 ? (
        <EmptyState
          title="No bookings require manual review"
          description="Awesome! All bookings were automatically matched by AI agents or are already resolved."
          className="rounded-card border border-dashed border-border py-8"
        />
      ) : (
        <div className="max-h-[560px] space-y-2.5 overflow-y-auto pr-1">
          {needsReviewBookings.map((b) => {
            const isSelected = selectedId === b.id;
            return (
              <div
                key={b.id}
                onClick={() => onSelect(b)}
                className={cn(
                  'cursor-pointer rounded-card border p-3.5 text-left transition',
                  isSelected
                    ? 'border-brand-500 bg-brand-soft/40 ring-1 ring-brand-500'
                    : 'border-border bg-surface-raised hover:bg-surface-sunken/60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading text-caption font-bold text-fg">{b.tourPackageName || 'Custom Sri Lanka Tour'}</p>
                    <p className="text-caption text-fg-muted">
                      {b.startDate} to {b.endDate}
                    </p>
                  </div>
                  <BookingStatusBadge status={b.status} />
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2 text-caption text-fg-muted">
                  <span className="font-semibold text-fg">👥 {b.groupSize} Guests</span>
                  {b.packageTier?.requiresAC && (
                    <span className="rounded border border-info/30 bg-info-soft px-1.5 py-0.5 font-medium text-info-fg">
                      ❄️ AC Required
                    </span>
                  )}
                  <span className="font-mono text-fg-muted">REF: {b.id.slice(0, 8)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
