import { useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { deletePackage, getPackages, type TourPackage } from '../../api/packages';
import { AdminPackageCard } from '../../components/admin/AdminPackageCard';
import { PackagesIcon } from '../../components/admin/icons';
import { PackageCreateForm } from '../../components/admin/PackageCreateForm';
import { Card, EmptyState, PageHeader, Skeleton } from '../../components/ui';

export function PackagesOverviewPage() {
  const [packages, setPackages] = useState<TourPackage[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  function loadPackages() {
    getPackages()
      .then(setPackages)
      .catch((err) => setListError(extractErrorMessage(err, 'Could not load tour packages.')));
  }

  useEffect(() => {
    loadPackages();
  }, []);

  async function handleDelete(id: string) {
    setListError(null);
    try {
      await deletePackage(id);
      loadPackages();
    } catch (err) {
      setListError(extractErrorMessage(err, 'Could not delete package.'));
    }
  }

  return (
    <>
      <Card className="mb-6 flex items-center gap-4 bg-gradient-to-br from-brand-soft to-surface-raised">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
          <PackagesIcon className="h-5 w-5" />
        </div>
        <PageHeader
          as="h1"
          title="Package management"
          description={packages ? `${packages.length} ${packages.length === 1 ? 'package' : 'packages'} configured` : 'Loading packages…'}
          className="mb-0"
        />
      </Card>

      <PackageCreateForm onCreated={loadPackages} />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <PackagesIcon className="h-5 w-5 text-fg-muted" />
          <h2 className="font-heading text-h3 text-fg">Existing packages</h2>
        </div>

        {listError && (
          <p role="alert" className="mb-4 rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
            {listError}
          </p>
        )}

        {packages === null && !listError && (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-28 rounded-card border border-border bg-surface-raised" />
            ))}
          </div>
        )}

        {packages !== null && packages.length === 0 && (
          <Card padded={false} className="border-dashed">
            <EmptyState
              icon={<PackagesIcon className="h-8 w-8" />}
              title="No tour packages yet."
              description="Use the form above to create the first one."
            />
          </Card>
        )}

        <div className="space-y-4">
          {packages?.map((pkg) => (
            <AdminPackageCard key={pkg.id} pkg={pkg} onChanged={loadPackages} onDelete={handleDelete} />
          ))}
        </div>
      </section>
    </>
  );
}
