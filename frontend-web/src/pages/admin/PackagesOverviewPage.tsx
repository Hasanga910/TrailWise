import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getPackages, type TourPackage } from '../../api/packages';

export function PackagesOverviewPage() {
  const [packages, setPackages] = useState<TourPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPackages()
      .then(setPackages)
      .catch((err) => setError(extractErrorMessage(err, 'Could not load tour packages.')));
  }, []);

  const tierCount = packages?.reduce((sum, pkg) => sum + pkg.tiers.length, 0) ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          {packages ? (
            <>
              <span className="font-semibold text-slate-700">{packages.length}</span>{' '}
              {packages.length === 1 ? 'package' : 'packages'} ·{' '}
              <span className="font-semibold text-slate-700">{tierCount}</span>{' '}
              {tierCount === 1 ? 'tier' : 'tiers'}
            </>
          ) : (
            'Loading packages...'
          )}
        </p>
        <Link
          to="/admin/packages/manage"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Manage Packages
        </Link>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!error && packages === null && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
              <div className="h-5 w-2/3 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-1/2 rounded bg-slate-200" />
              <div className="mt-6 h-4 w-full rounded bg-slate-200" />
              <div className="mt-2 h-4 w-full rounded bg-slate-200" />
            </div>
          ))}
        </div>
      )}

      {!error && packages !== null && packages.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-600">No tour packages yet.</p>
          <Link to="/admin/packages/manage" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800">
            Create your first package
          </Link>
        </div>
      )}

      {packages && packages.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <article
              key={pkg.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-heading text-lg font-bold text-slate-900">{pkg.name}</h3>
                <span className="whitespace-nowrap rounded-full bg-accent-500/15 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
                  {pkg.theme}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {pkg.durationDays} {pkg.durationDays === 1 ? 'day' : 'days'} · up to {pkg.maxGroupSize}{' '}
                travelers
              </p>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-brand-700">${pkg.basePricePerPerson.toFixed(2)}</span>
                <span className="text-sm text-slate-500">/person</span>
              </div>

              <ul className="mt-4 flex-1 divide-y divide-slate-100 border-t border-slate-100">
                {pkg.tiers.map((tier) => (
                  <li key={tier.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="font-medium text-slate-700">{tier.classType}</span>
                    <span className="flex items-center gap-1.5">
                      {tier.includesFood && (
                        <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">
                          food
                        </span>
                      )}
                      {tier.requiresAC && (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                          AC
                        </span>
                      )}
                      <span className="font-semibold text-slate-900">${tier.basePricePerPerson.toFixed(2)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
