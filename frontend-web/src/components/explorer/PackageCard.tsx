import { Link } from 'react-router-dom';
import { Clock, MapPin, Users } from 'lucide-react';
import type { TourPackage } from '../../api/packages';
import { formatPrice, pluralize } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { PackagePhoto } from './packagePhoto';
import { locationSummary, startingPrice, tierClasses } from './packageSummary';
import { StarRating } from './StarRating';

/** Grid card for the public explorer and the home carousel. The whole card is one link. */
export function PackageCard({ pkg, linkSearch = '' }: { pkg: TourPackage; linkSearch?: string }) {
  const { shown, more, full } = locationSummary(pkg);
  return (
    <Card interactive padded={false} className="group relative flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden">
        <PackagePhoto pkg={pkg} className="h-full w-full transition duration-300 group-hover:scale-105" />
        <Badge tone="brand" className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] shadow-soft" title={pkg.theme}>
          <span className="min-w-0 truncate">{pkg.theme}</span>
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-heading text-h4 text-fg">
            <Link
              to={`/explore/${pkg.id}${linkSearch}`}
              className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {pkg.name}
            </Link>
          </h3>
          <StarRating rating={pkg.averageRating ?? 0} reviewCount={pkg.reviewCount ?? 0} size="sm" className="mt-1" />
        </div>

        {shown.length > 0 && (
          <p className="flex items-start gap-1.5 text-caption text-fg-muted" title={full}>
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {shown.join(' · ')}
              {more > 0 && ` +${more} more`}
            </span>
          </p>
        )}

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-fg-muted">
          <li className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden /> {pluralize(pkg.durationDays, 'day')}
          </li>
          <li className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden /> Up to {pkg.maxGroupSize}
          </li>
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap gap-1">
            {tierClasses(pkg).map((c) => (
              <Badge key={c} tone="neutral">
                {c}
              </Badge>
            ))}
          </div>
          <p className="text-right">
            <span className="block text-caption text-fg-muted">From</span>
            <span className="font-heading text-h4 text-fg">{formatPrice(startingPrice(pkg))}</span>
            <span className="text-caption text-fg-muted"> /person</span>
          </p>
        </div>
      </div>
    </Card>
  );
}
