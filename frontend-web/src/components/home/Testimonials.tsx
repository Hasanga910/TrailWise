import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Quote } from 'lucide-react';
import { getFeaturedReviews, type FeaturedReview } from '../../api/reviews';
import { StarRating } from '../explorer/StarRating';
import { Skeleton } from '../ui/Skeleton';
import { formatDate } from '../../utils/format';

/** Real reviews from completed trips. The whole section is omitted when there is nothing to show. */
export function Testimonials() {
  // null while loading: a placeholder holds the space so the footer doesn't jump when reviews arrive.
  const [reviews, setReviews] = useState<FeaturedReview[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getFeaturedReviews(6, controller.signal)
      .then(setReviews)
      .catch(() => setReviews([]));
    return () => controller.abort();
  }, []);

  if (reviews === null) {
    return (
      <section aria-label="Traveler reviews" className="bg-surface-sunken py-16">
        <div role="status" aria-label="Loading reviews" className="mx-auto max-w-6xl px-4 sm:px-6">
          <Skeleton className="h-9 w-64" />
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (reviews.length === 0) return null;

  return (
    <section aria-labelledby="testimonials-heading" className="bg-surface-sunken py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="testimonials-heading" className="font-heading text-h1 text-fg">
          What travelers say
        </h2>
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <li key={review.id} className="flex flex-col rounded-card border border-border bg-surface-raised p-6 shadow-soft">
              <Quote className="h-6 w-6 text-brand-text" aria-hidden />
              <blockquote className="mt-3 flex-1 text-body text-fg">“{review.comment}”</blockquote>
              <div className="mt-4 border-t border-border pt-4">
                <StarRating rating={review.rating} showValue={false} />
                <p className="mt-1 text-caption text-fg-muted">
                  {review.reviewerDisplayName} on{' '}
                  <Link to={`/explore/${review.packageId}`} className="font-semibold text-brand-text hover:underline">
                    {review.packageName}
                  </Link>
                  {formatDate(review.submittedAt) && <> · {formatDate(review.submittedAt)}</>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
