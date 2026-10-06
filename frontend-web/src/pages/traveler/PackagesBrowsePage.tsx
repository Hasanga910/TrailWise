import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getPackages, type TourPackage } from '../../api/packages';
import { PackagePhoto } from '../../components/explorer/packagePhoto';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '../../components/ui';

export function PackagesBrowsePage() {
  const [packages, setPackages] = useState<TourPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getPackages()
      .then(setPackages)
      .catch((err) => setError(extractErrorMessage(err, 'Could not load tour packages.')));
  }, []);

  return (
    <div>
      <PageHeader title="Tour Packages" description="Browse available packages and request a booking." />

      {error && (
        <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
          {error}
        </p>
      )}

      {!error && packages === null && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-1/2" />
              <Skeleton className="mt-6 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-full" />
            </Card>
          ))}
        </div>
      )}

      {!error && packages !== null && packages.length === 0 && (
        <Card padded={false} className="border-dashed">
          <EmptyState title="No tour packages yet." />
        </Card>
      )}

      {packages && packages.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <Card key={pkg.id} padded={false} interactive className="flex flex-col overflow-hidden">
              <div className="relative aspect-[4/3] overflow-hidden">
                <PackagePhoto pkg={pkg} className="h-full w-full" />
                <Badge tone="brand" className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] shadow-soft" title={pkg.theme}>
                  <span className="min-w-0 truncate">{pkg.theme}</span>
                </Badge>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="break-words font-heading text-h3 text-fg">{pkg.name}</h3>

                <p className="mt-1 text-body text-fg-muted">
                  {pkg.durationDays} {pkg.durationDays === 1 ? 'day' : 'days'} · up to {pkg.maxGroupSize} travelers
                </p>

                {pkg.locations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pkg.locations.map((loc) => (
                      <Badge key={loc.id}>{loc.name}</Badge>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-heading text-h2 text-brand-text">${pkg.basePricePerPerson.toFixed(2)}</span>
                  <span className="text-body text-fg-muted">/person</span>
                </div>

                <ul className="mt-4 flex-1 divide-y divide-border border-t border-border">
                  {pkg.tiers.map((tier) => (
                    <li key={tier.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-body">
                      <span className="font-medium text-fg">{tier.classType}</span>
                      <span className="flex items-center gap-1.5">
                        {tier.includesFood && <Badge tone="brand">food</Badge>}
                        {tier.requiresAC && <Badge>AC</Badge>}
                        <span className="font-semibold text-fg">${tier.basePricePerPerson.toFixed(2)}</span>
                        <Button size="sm" onClick={() => navigate(`/traveler/bookings/new?tier=${tier.id}`)}>
                          Request
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
