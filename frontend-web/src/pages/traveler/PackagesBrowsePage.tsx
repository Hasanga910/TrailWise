import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, extractErrorMessage } from '../../api/apiClient';
import { getPackages, type TourPackage } from '../../api/packages';

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
      <div className="mb-6">
        <h2 className="font-heading text-xl font-bold text-fg">Tour Packages</h2>
        <p className="mt-1 text-sm text-fg-muted">Browse available packages and request a booking.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-fg">
          {error}
        </p>
      )}

      {!error && packages === null && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-surface-raised p-5">
              <div className="h-5 w-2/3 rounded bg-neutral-soft" />
              <div className="mt-3 h-4 w-1/2 rounded bg-neutral-soft" />
              <div className="mt-6 h-4 w-full rounded bg-neutral-soft" />
              <div className="mt-2 h-4 w-full rounded bg-neutral-soft" />
            </div>
          ))}
        </div>
      )}

      {!error && packages !== null && packages.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
          <p className="font-medium text-fg-muted">No tour packages yet.</p>
        </div>
      )}

      {packages && packages.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <article
              key={pkg.id}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface-raised shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="h-36 bg-neutral-soft">
                {pkg.photoUrl ? (
                  <img
                    src={`${API_BASE_URL}${pkg.photoUrl}`}
                    alt={pkg.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-fg-muted">No photo yet</div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading text-lg font-bold text-fg">{pkg.name}</h3>
                  <span className="whitespace-nowrap rounded-full bg-accent-500/15 px-2.5 py-0.5 text-xs font-semibold text-warning-fg">
                    {pkg.theme}
                  </span>
                </div>

                <p className="mt-1 text-sm text-fg-muted">
                  {pkg.durationDays} {pkg.durationDays === 1 ? 'day' : 'days'} · up to {pkg.maxGroupSize}{' '}
                  travelers
                </p>

                {pkg.locations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pkg.locations.map((loc) => (
                      <span
                        key={loc.id}
                        className="rounded-full bg-neutral-soft px-2 py-0.5 text-[11px] font-medium text-fg-muted"
                      >
                        {loc.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-brand-text">${pkg.basePricePerPerson.toFixed(2)}</span>
                  <span className="text-sm text-fg-muted">/person</span>
                </div>

                <ul className="mt-4 flex-1 divide-y divide-border border-t border-border">
                  {pkg.tiers.map((tier) => (
                    <li key={tier.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                      <span className="font-medium text-fg">{tier.classType}</span>
                      <span className="flex items-center gap-1.5">
                        {tier.includesFood && (
                          <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand-text">
                            food
                          </span>
                        )}
                        {tier.requiresAC && (
                          <span className="rounded-full bg-neutral-soft px-1.5 py-0.5 text-[11px] font-medium text-fg-muted">
                            AC
                          </span>
                        )}
                        <span className="font-semibold text-fg">${tier.basePricePerPerson.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => navigate(`/traveler/bookings/new?tier=${tier.id}`)}
                          className="rounded-full bg-brand-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-800"
                        >
                          Request
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
