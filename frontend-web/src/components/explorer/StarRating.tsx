import { Star } from 'lucide-react';
import { cn } from '../ui/cn';
import { pluralize } from '../../utils/format';

export interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  /** Show the numeric value and count next to the stars. */
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' } as const;

/** Read-only star display; always exposes the value to screen readers. */
export function StarRating({ rating, reviewCount, showValue = true, size = 'md', className }: StarRatingProps) {
  const rounded = Math.round(rating * 2) / 2;
  const label =
    reviewCount === 0 || (reviewCount === undefined && rating === 0)
      ? 'No reviews yet'
      : `Rated ${rating.toFixed(1)} out of 5${reviewCount !== undefined ? ` from ${pluralize(reviewCount, 'review')}` : ''}`;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-caption text-fg-muted', className)}>
      <span className="inline-flex" role="img" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => {
          const fill = rounded >= n ? 'full' : rounded >= n - 0.5 ? 'half' : 'empty';
          return (
            <span key={n} className="relative inline-flex" aria-hidden>
              <Star className={cn(SIZES[size], 'text-border')} />
              {fill !== 'empty' && (
                <span className={cn('absolute inset-y-0 left-0 overflow-hidden', fill === 'half' ? 'w-1/2' : 'w-full')}>
                  <Star className={cn(SIZES[size], 'fill-accent-500 text-accent-500')} />
                </span>
              )}
            </span>
          );
        })}
      </span>
      {showValue && (
        <span aria-hidden>
          {reviewCount === 0 || (reviewCount === undefined && rating === 0)
            ? 'No reviews yet'
            : `${rating.toFixed(1)}${reviewCount !== undefined ? ` (${reviewCount})` : ''}`}
        </span>
      )}
    </span>
  );
}
