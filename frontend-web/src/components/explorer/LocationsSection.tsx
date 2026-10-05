import { Suspense } from 'react';
import { MapPin } from 'lucide-react';
import type { PackageLocation } from '../../api/packages';
import { lazyNamed } from '../layout/lazyNamed';
import { Skeleton } from '../ui/Skeleton';
import { plottable } from './packageSummary';

const LocationsMap = lazyNamed(() => import('./LocationsMap'), 'LocationsMap');

/** Numbered stop list plus a map. Locations without coordinates stay in the list but are not plotted. */
export function LocationsSection({ locations }: { locations: PackageLocation[] }) {
  const points = plottable(locations);
  const unplotted = locations.length - points.length;

  if (locations.length === 0) {
    return <p className="text-body text-fg-muted">The route for this tour hasn't been published yet.</p>;
  }

  return (
    <div className="space-y-4">
      {points.length > 0 ? (
        <Suspense fallback={<Skeleton className="h-80 w-full sm:h-96" />}>
          <LocationsMap points={points} />
        </Suspense>
      ) : (
        <p className="rounded-card border border-border bg-surface-sunken p-4 text-body text-fg-muted">
          The map for this tour isn't available yet. The stops are listed below.
        </p>
      )}

      <ol className="grid gap-2 sm:grid-cols-2">
        {locations.map((l, i) => {
          const onMap = typeof l.latitude === 'number' && typeof l.longitude === 'number';
          return (
            <li key={l.id} className="flex items-center gap-3 rounded-input border border-border bg-surface-raised px-3 py-2">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-caption font-bold text-white"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-body font-medium text-fg">{l.name}</span>
              {!onMap && (
                <span className="flex items-center gap-1 text-caption text-fg-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Not on map
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {points.length > 0 && unplotted > 0 && (
        <p className="text-caption text-fg-muted">Some stops can't be placed on the map yet.</p>
      )}
    </div>
  );
}
