import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { SearchX, SlidersHorizontal, X } from 'lucide-react';
import { extractErrorMessage } from '../../api/apiClient';
import { getPackageFacets, getPackages, type PackageFacets, type PackageQuery, type TourPackage } from '../../api/packages';
import { FilterFields } from '../../components/explorer/FilterFields';
import { PackageCard } from '../../components/explorer/PackageCard';
import { PackageListItem } from '../../components/explorer/PackageListItem';
import { ViewToggle, type ExplorerView } from '../../components/explorer/ViewToggle';
import {
  FILTER_KEYS,
  activeFilterCount,
  readValues,
  toQuery,
  type FilterKey,
} from '../../components/explorer/explorerFilters';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatDate, pluralize } from '../../utils/format';

const VIEW_STORAGE_KEY = 'trailwise_explorer_view';
const SEARCH_DEBOUNCE_MS = 300;

interface Loaded {
  key: string;
  packages?: TourPackage[];
  error?: string;
}

function storedView(): ExplorerView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function ExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const values = readValues(searchParams);
  const view: ExplorerView = searchParams.get('view') === 'list' ? 'list' : searchParams.get('view') === 'grid' ? 'grid' : storedView();

  const [facets, setFacets] = useState<PackageFacets | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const queryKey = JSON.stringify(toQuery(values));
  const debouncedKey = useDebouncedValue(queryKey, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const controller = new AbortController();
    getPackageFacets(controller.signal)
      .then(setFacets)
      .catch(() => {
        // Facets only enrich the filter bar (theme chips, placeholders); the explorer works without them.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const key = debouncedKey;
    getPackages(JSON.parse(key) as PackageQuery, controller.signal)
      .then((packages) => setLoaded({ key, packages }))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setLoaded({ key, error: extractErrorMessage(err, 'Could not load tours. Please try again.') });
      });
    return () => controller.abort();
  }, [debouncedKey, retryNonce]);

  function update(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: true });
  }

  function setValue(key: FilterKey, value: string) {
    update((next) => (value === '' ? next.delete(key) : next.set(key, value)));
  }

  function setSort(sort: string, dir: string) {
    update((next) => {
      next.delete('sort');
      next.delete('dir');
      if (sort) next.set('sort', sort);
      if (sort && dir) next.set('dir', dir);
    });
  }

  function setView(next: ExplorerView) {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // remembering the view is a convenience only
    }
    update((params) => params.set('view', next));
  }

  function clearFilters() {
    update((next) => FILTER_KEYS.filter((k) => k !== 'sort' && k !== 'dir').forEach((k) => next.delete(k)));
  }

  const filterCount = activeFilterCount(values);
  const settled = loaded !== null && loaded.key === debouncedKey;
  const refreshing = loaded !== null && (loaded.key !== debouncedKey || debouncedKey !== queryKey);
  const packages = loaded?.packages;

  const heading = useMemo(() => (settled && packages ? pluralize(packages.length, 'tour') + ' found' : 'Finding tours…'), [settled, packages]);

  // The home search's traveler count and date ride along to each tour so booking can be prefilled.
  const carry = new URLSearchParams();
  const guestsParam = searchParams.get('guests');
  const startParam = searchParams.get('start');
  if (guestsParam && /^\d+$/.test(guestsParam)) carry.set('guests', guestsParam);
  if (startParam && /^\d{4}-\d{2}-\d{2}$/.test(startParam)) carry.set('start', startParam);
  const linkSearch = carry.toString() ? `?${carry.toString()}` : '';

  const filterProps = { values, facets, onChange: setValue, onSortChange: setSort };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-heading text-h1 text-fg">Explore Sri Lanka tours</h1>
        <p className="mt-2 text-body-lg text-fg-muted">
          Browse every package, compare classes and prices, and see where each tour goes. No account needed.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 rounded-card border border-border bg-surface-raised p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-h4 text-fg">Filters</h2>
              {filterCount > 0 && (
                <button type="button" onClick={clearFilters} className="text-caption font-semibold text-brand-text hover:underline">
                  Clear all
                </button>
              )}
            </div>
            <FilterFields {...filterProps} idPrefix="side" />
          </div>
        </aside>

        <section aria-labelledby="results-heading">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input
              aria-label="Search tours"
              type="search"
              placeholder="Search by place, theme or tour name"
              value={values.q}
              onChange={(e) => setValue('q', e.target.value)}
              wrapperClassName="min-w-0 flex-1 sm:min-w-64"
            />
            <Button variant="secondary" className="lg:hidden" leftIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden />} onClick={() => setDrawerOpen(true)}>
              Filters{filterCount > 0 ? ` (${filterCount})` : ''}
            </Button>
            <ViewToggle value={view} onChange={setView} />
          </div>

          {startParam && /^\d{4}-\d{2}-\d{2}$/.test(startParam) && (
            <p className="mb-3 flex w-fit items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-caption font-semibold text-brand-fg">
              Starting {formatDate(`${startParam}T00:00:00`)}
              <button
                type="button"
                aria-label="Remove start date"
                onClick={() => update((next) => next.delete('start'))}
                className="rounded-full p-0.5 hover:bg-brand-500/20"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </p>
          )}

          <h2 id="results-heading" aria-live="polite" className="mb-4 text-body font-semibold text-fg-muted">
            {heading}
          </h2>

          {loaded?.error && !packages && (
            <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-5 text-danger-fg">
              <p className="font-semibold">{loaded.error}</p>
              <Button className="mt-3" size="sm" variant="secondary" onClick={() => setRetryNonce((n) => n + 1)}>
                Try again
              </Button>
            </div>
          )}

          {loaded === null && <ResultsSkeleton view={view} />}

          {packages && packages.length === 0 && (
            <div className="rounded-card border border-border bg-surface-raised">
              <EmptyState
                icon={<SearchX className="h-8 w-8" aria-hidden />}
                title="No tours match your filters"
                description="Try widening the price or duration range, or clear the filters to see every tour."
                action={filterCount > 0 ? <Button onClick={clearFilters}>Clear filters</Button> : undefined}
              />
            </div>
          )}

          {packages && packages.length > 0 && (
            <div
              aria-busy={refreshing}
              className={`transition-opacity duration-200 ${refreshing ? 'opacity-60' : 'opacity-100'} ${
                view === 'grid' ? 'grid gap-6 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-4'
              }`}
            >
              {packages.map((pkg) => (view === 'grid' ? <PackageCard key={pkg.id} pkg={pkg} linkSearch={linkSearch} /> : <PackageListItem key={pkg.id} pkg={pkg} linkSearch={linkSearch} />))}
            </div>
          )}
        </section>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filters">
        <div className="space-y-6 p-5">
          <FilterFields {...filterProps} hideSearch idPrefix="drawer" />
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => setDrawerOpen(false)}>
              Show {packages ? pluralize(packages.length, 'tour') : 'tours'}
            </Button>
            {filterCount > 0 && (
              <Button variant="secondary" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
}

function ResultsSkeleton({ view }: { view: ExplorerView }) {
  return (
    <div role="status" aria-label="Loading tours" className={view === 'grid' ? 'grid gap-6 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-4'}>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className={view === 'grid' ? 'h-80' : 'h-44'} />
      ))}
    </div>
  );
}
