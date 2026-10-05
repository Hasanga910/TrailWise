import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Clock, Users } from 'lucide-react';
import { extractErrorMessage } from '../../api/apiClient';
import { getActiveDiscounts, type ActiveDiscount } from '../../api/discounts';
import { getPackageById, type TourPackage } from '../../api/packages';
import { getPackageReviews, type PackageReviews } from '../../api/reviews';
import { BookingCard } from '../../components/explorer/BookingCard';
import { LocationsSection } from '../../components/explorer/LocationsSection';
import { PackagePhoto } from '../../components/explorer/packagePhoto';
import { ReviewsSection } from '../../components/explorer/ReviewsSection';
import { StarRating } from '../../components/explorer/StarRating';
import { TierComparison } from '../../components/explorer/TierComparison';
import { Badge } from '../../components/ui/Badge';
import { buttonClasses } from '../../components/ui/buttonStyles';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { usePageTitle } from '../../hooks/usePageTitle';
import { pluralize } from '../../utils/format';

type LoadState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error'; message: string }
  | { status: 'ready'; pkg: TourPackage };

export function PackageDetailPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const [searchParams] = useSearchParams();

  const [state, setState] = useState<{ id: string; value: LoadState } | null>(null);
  const [reviews, setReviews] = useState<PackageReviews | null>(null);
  const [reviewsFailed, setReviewsFailed] = useState(false);
  const [discounts, setDiscounts] = useState<ActiveDiscount[]>([]);
  const [chosenTierId, setChosenTierId] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!packageId) return;
    const controller = new AbortController();
    getPackageById(packageId, controller.signal)
      .then((pkg) => setState({ id: packageId, value: { status: 'ready', pkg } }))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        const notFound = axios.isAxiosError(err) && err.response?.status === 404;
        setState({
          id: packageId,
          value: notFound ? { status: 'notFound' } : { status: 'error', message: extractErrorMessage(err, 'Could not load this tour.') },
        });
      });
    // Reviews and offers are enhancements: their failure must not hide the tour.
    getPackageReviews(packageId, controller.signal)
      .then((data) => {
        setReviews(data);
        setReviewsFailed(false);
      })
      .catch((err) => {
        if (!axios.isCancel(err)) setReviewsFailed(true);
      });
    getActiveDiscounts(controller.signal)
      .then(setDiscounts)
      .catch(() => setDiscounts([]));
    return () => controller.abort();
  }, [packageId, retryNonce]);

  const current: LoadState = state && state.id === packageId ? state.value : { status: 'loading' };
  const pkg = current.status === 'ready' ? current.pkg : null;
  usePageTitle(pkg?.name);

  const tiers = useMemo(() => [...(pkg?.tiers ?? [])].sort((a, b) => a.basePricePerPerson - b.basePricePerPerson), [pkg]);
  // The cheapest class is preselected until the visitor picks another.
  const selectedTier = tiers.find((t) => t.id === chosenTierId) ?? tiers[0] ?? null;

  if (current.status === 'loading') return <DetailSkeleton />;

  if (current.status === 'notFound') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title="We couldn't find that tour"
          description="It may have been removed or the link is incorrect."
          action={
            <Link to="/explore" className={buttonClasses('primary')}>
              Browse all tours
            </Link>
          }
        />
      </div>
    );
  }

  if (current.status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-6 text-danger-fg">
          <p className="font-semibold">{current.message}</p>
          <Button className="mt-4" variant="secondary" onClick={() => setRetryNonce((n) => n + 1)}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!pkg) return null;

  return (
    <article>
      <header className="relative isolate overflow-hidden bg-brand-950">
        <PackagePhoto pkg={pkg} priority className="absolute inset-0 -z-10 h-full w-full opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-950 via-brand-950/50 to-brand-950/20" />
        <div className="mx-auto flex min-h-[22rem] max-w-6xl flex-col justify-end px-4 pb-10 pt-8 text-white sm:px-6 sm:min-h-[26rem]">
          <Link to="/explore" className="mb-auto inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-white/85 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden /> All tours
          </Link>
          <Badge tone="brand" className="mb-3 w-fit">
            {pkg.theme}
          </Badge>
          <h1 className="font-heading text-h1 sm:text-display">{pkg.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/90">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden /> {pluralize(pkg.durationDays, 'day')}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden /> Up to {pkg.maxGroupSize} guests
            </span>
            <StarRating rating={pkg.averageRating ?? 0} reviewCount={pkg.reviewCount ?? 0} className="!text-white/90" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="classes-heading">
            <h2 id="classes-heading" className="mb-4 font-heading text-h2 text-fg">
              Choose your class
            </h2>
            {tiers.length > 0 ? (
              <TierComparison tiers={tiers} selectedId={selectedTier?.id ?? null} onSelect={setChosenTierId} />
            ) : (
              <p className="text-body text-fg-muted">Classes for this tour haven't been published yet.</p>
            )}
          </section>

          <section aria-labelledby="route-heading">
            <h2 id="route-heading" className="mb-4 font-heading text-h2 text-fg">
              Where you'll go
            </h2>
            <LocationsSection locations={pkg.locations} />
          </section>

          <section aria-labelledby="reviews-heading">
            <h2 id="reviews-heading" className="mb-4 font-heading text-h2 text-fg">
              Traveler reviews
            </h2>
            {reviews ? (
              <ReviewsSection data={reviews} />
            ) : reviewsFailed ? (
              <p className="text-body text-fg-muted">Reviews couldn't be loaded right now.</p>
            ) : (
              <Skeleton className="h-40" />
            )}
          </section>
        </div>

        <aside aria-label="Booking" className="lg:pt-0">
          <BookingCard tier={selectedTier} discounts={discounts} guests={searchParams.get('guests')} start={searchParams.get('start')} />
        </aside>
      </div>
    </article>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading tour" className="space-y-8">
      <Skeleton className="h-96 w-full rounded-none" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
