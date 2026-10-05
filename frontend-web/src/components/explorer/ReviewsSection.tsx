import { useState } from 'react';
import { BadgeCheck, MessageSquareText } from 'lucide-react';
import type { PackageReviews } from '../../api/reviews';
import { formatDate, pluralize } from '../../utils/format';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ratingDistribution } from './packageSummary';
import { StarRating } from './StarRating';

const PAGE = 5;

export function ReviewsSection({ data }: { data: PackageReviews }) {
  const [visible, setVisible] = useState(PAGE);

  if (data.totalReviews === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised">
        <EmptyState
          icon={<MessageSquareText className="h-8 w-8" aria-hidden />}
          title="No reviews yet"
          description="Reviews appear here after travelers complete this tour."
        />
      </div>
    );
  }

  const counts = ratingDistribution(data.reviews);
  const shown = data.reviews.slice(0, visible);

  return (
    <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
      <div>
        <p className="font-heading text-display text-fg">{data.averageRating.toFixed(1)}</p>
        <StarRating rating={data.averageRating} reviewCount={data.totalReviews} showValue={false} size="lg" />
        <p className="mt-1 text-caption text-fg-muted">{pluralize(data.totalReviews, 'review')}</p>

        <ul className="mt-4 space-y-1.5" aria-label="Rating breakdown">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = counts[star - 1];
            const pct = data.totalReviews > 0 ? Math.round((count / data.totalReviews) * 100) : 0;
            return (
              <li key={star} className="flex items-center gap-2 text-caption text-fg-muted">
                <span className="w-9 shrink-0">{star} star</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-soft" aria-hidden>
                  <span className="block h-full rounded-full bg-accent-500" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-6 shrink-0 text-right">{count}</span>
                <span className="sr-only"> ({pct}%)</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <ul className="space-y-4">
          {shown.map((review) => (
            <li key={review.id} className="rounded-card border border-border bg-surface-raised p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StarRating rating={review.rating} showValue={false} />
                <span className="flex items-center gap-1.5 text-caption text-fg-muted">
                  {review.isVerifiedTrip && <BadgeCheck className="h-4 w-4 text-brand-text" aria-hidden />}
                  {review.reviewerDisplayName}
                  {formatDate(review.submittedAt) && <> · {formatDate(review.submittedAt)}</>}
                </span>
              </div>
              {review.comment && <p className="mt-2 text-body text-fg">{review.comment}</p>}
            </li>
          ))}
        </ul>
        {visible < data.reviews.length && (
          <Button variant="secondary" className="mt-4" onClick={() => setVisible((v) => v + PAGE)}>
            Show more reviews
          </Button>
        )}
      </div>
    </div>
  );
}
