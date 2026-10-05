import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPackages, type TourPackage } from '../../api/packages';
import { PackageCard } from '../explorer/PackageCard';
import { IconButton } from '../ui/IconButton';
import { Skeleton } from '../ui/Skeleton';

type State = { status: 'loading' } | { status: 'ready'; packages: TourPackage[] } | { status: 'hidden' };

/** Top-rated tours. Never blocks or breaks the page: on failure or an empty catalogue it renders nothing. */
export function FeaturedCarousel() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const scroller = useRef<HTMLUListElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getPackages({ sort: 'rating', dir: 'desc' }, controller.signal)
      .then((packages) => setState(packages.length > 0 ? { status: 'ready', packages: packages.slice(0, 8) } : { status: 'hidden' }))
      .catch(() => setState({ status: 'hidden' }));
    return () => controller.abort();
  }, []);

  // Arrows only make sense when the cards overflow the row.
  const ready = state.status === 'ready';
  useEffect(() => {
    const el = scroller.current;
    if (!ready || !el) return;
    const measure = () => setCanScroll(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  if (state.status === 'hidden') return null;

  const hasReviews = state.status === 'ready' && state.packages.some((p) => (p.reviewCount ?? 0) > 0);

  function scrollBy(direction: 1 | -1) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * Math.max(280, el.clientWidth * 0.8), behavior: 'smooth' });
  }

  return (
    <section aria-labelledby="featured-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 id="featured-heading" className="font-heading text-h1 text-fg">
            {hasReviews ? 'Top-rated tours' : 'Featured tours'}
          </h2>
          <p className="mt-1 text-body text-fg-muted">
            {hasReviews ? 'Loved by travelers, ready to book.' : 'Handpicked tours, ready to book.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/explore" className="mr-2 hidden text-body font-semibold text-brand-text hover:underline sm:inline">
            View all tours
          </Link>
          {canScroll && (
            <>
              <IconButton label="Scroll tours left" variant="secondary" icon={<ChevronLeft className="h-5 w-5" />} onClick={() => scrollBy(-1)} className="hidden md:inline-flex" />
              <IconButton label="Scroll tours right" variant="secondary" icon={<ChevronRight className="h-5 w-5" />} onClick={() => scrollBy(1)} className="hidden md:inline-flex" />
            </>
          )}
        </div>
      </div>

      {state.status === 'loading' ? (
        <div role="status" aria-label="Loading tours" className="flex gap-5 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[27rem] w-72 shrink-0 sm:w-80" />
          ))}
        </div>
      ) : (
        <ul ref={scroller} className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 [&>li:first-child]:ml-auto [&>li:last-child]:mr-auto" aria-label="Featured tours">
          {state.packages.map((pkg) => (
            <li key={pkg.id} className="w-72 shrink-0 snap-start sm:w-80">
              <PackageCard pkg={pkg} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
