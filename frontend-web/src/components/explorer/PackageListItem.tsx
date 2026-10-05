import { Link } from 'react-router-dom';
import { Clock, MapPin, Users } from 'lucide-react';
import type { TourPackage } from '../../api/packages';
import { formatPrice, pluralize } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { PackagePhoto } from './packagePhoto';
import { locationSummary, startingPrice, tierClasses } from './packageSummary';
import { StarRating } from './StarRating';

/** Wide row variant for the explorer's list view. */
export function PackageListItem({ pkg, linkSearch = '' }: { pkg: TourPackage; linkSearch?: string }) {
  const { shown, more } = locationSummary(pkg, 5);
  return (
    <Card interactive padded={false} className="group relative flex flex-col overflow-hidden sm:flex-row">
      <div className="aspect-[16/9] shrink-0 overflow-hidden sm:aspect-auto sm:w-64 lg:w-72">
        <PackagePhoto pkg={pkg} className="h-full w-full transition duration-300 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Badge tone="brand">{pkg.theme}</Badge>
            <h3 className="mt-2 font-heading text-h3 text-fg">
              <Link
                to={`/explore/${pkg.id}${linkSearch}`}
                className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {pkg.name}
              </Link>
            </h3>
            <StarRating rating={pkg.averageRating ?? 0} reviewCount={pkg.reviewCount ?? 0} className="mt-1" />
          </div>
          <p className="text-right">
            <span className="block text-caption text-fg-muted">From</span>
            <span className="font-heading text-h2 text-fg">{formatPrice(startingPrice(pkg))}</span>
            <span className="text-caption text-fg-muted"> /person</span>
          </p>
        </div>

        {shown.length > 0 && (
          <p className="flex items-start gap-1.5 text-body text-fg-muted">
            <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {shown.join(' · ')}
              {more > 0 && ` +${more} more`}
            </span>
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-fg-muted">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" aria-hidden /> {pluralize(pkg.durationDays, 'day')}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" aria-hidden /> Up to {pkg.maxGroupSize} guests
          </span>
          <span className="flex flex-wrap gap-1">
            {tierClasses(pkg).map((c) => (
              <Badge key={c} tone="neutral">
                {c}
              </Badge>
            ))}
          </span>
        </div>
      </div>
    </Card>
  );
}
