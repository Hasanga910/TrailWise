import { useEffect, useState } from 'react';
import { Clock, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { extractErrorMessage } from '../../api/apiClient';
import { deletePackage, getPackages, type TourPackage } from '../../api/packages';
import { PackagePhoto } from '../explorer/packagePhoto';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { PageHeader } from '../ui/PageHeader';
import { Skeleton } from '../ui/Skeleton';
import { notify } from '../ui/notify';
import { PackageEditor } from './PackageEditor';
import { money, sortTiers } from './tierHelpers';

type Editor = { kind: 'new' } | { kind: 'edit'; id: string } | null;

/** Package catalogue: browse packages with their tier configuration, create, edit and delete them. */
export function PackageManager() {
  const [packages, setPackages] = useState<TourPackage[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [deleting, setDeleting] = useState<TourPackage | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function loadPackages() {
    setListError(null);
    getPackages()
      .then(setPackages)
      .catch((err) => setListError(extractErrorMessage(err, 'Could not load tour packages.')));
  }

  useEffect(() => {
    loadPackages();
  }, []);

  function replacePackage(updated: TourPackage) {
    setPackages((prev) => prev?.map((p) => (p.id === updated.id ? updated : p)) ?? prev);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deletePackage(deleting.id);
      notify.success('Package deleted.', deleting.name);
      setDeleting(null);
      loadPackages();
    } catch (err) {
      setDeleteError(extractErrorMessage(err, 'Could not delete package.'));
    } finally {
      setBusy(false);
    }
  }

  const editing = editor?.kind === 'edit' ? packages?.find((p) => p.id === editor.id) : undefined;

  return (
    <>
      <PageHeader
        title="Package catalogue"
        description="Tour packages and their tiers: class, food, AC requirement and price."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setEditor({ kind: 'new' })}>
            New package
          </Button>
        }
      />

      {listError && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
          <span>{listError}</span>
          <Button size="sm" variant="secondary" onClick={loadPackages}>
            Retry
          </Button>
        </div>
      )}

      {packages === null && !listError && (
        <div role="status" aria-label="Loading packages" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      )}

      {packages !== null && packages.length === 0 && (
        <Card>
          <EmptyState
            title="No tour packages yet."
            description="Create the first package, then add its tiers."
            action={<Button onClick={() => setEditor({ kind: 'new' })}>New package</Button>}
          />
        </Card>
      )}

      {packages !== null && packages.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((pkg) => (
            <li key={pkg.id}>
              <Card padded={false} className="flex h-full flex-col overflow-hidden">
                <PackagePhoto pkg={pkg} className="aspect-[16/7] w-full" />
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h3 className="font-heading text-h4 text-fg">{pkg.name}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-muted">
                      <Badge tone="brand">{pkg.theme}</Badge>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden /> {pkg.durationDays} days
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden /> up to {pkg.maxGroupSize}
                      </span>
                    </p>
                  </div>
                  <ul aria-label={`${pkg.name} tiers`} className="divide-y divide-border rounded-input border border-border">
                    {sortTiers(pkg.tiers).map((tier) => (
                      <li key={tier.id} className="flex items-center justify-between gap-2 px-3 py-2 text-body">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-fg">{tier.classType}</span>
                          {tier.includesFood && <Badge tone="brand">Food</Badge>}
                          {tier.requiresAC && <Badge tone="info">AC</Badge>}
                        </span>
                        <span className="font-semibold text-fg">{money(tier.basePricePerPerson)}</span>
                      </li>
                    ))}
                  </ul>
                  {pkg.locations.length > 0 && (
                    <ul aria-label={`${pkg.name} locations`} className="flex flex-wrap gap-1.5">
                      {pkg.locations.map((loc) => (
                        <li key={loc.id}>
                          <Badge>{loc.name}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto flex gap-2 pt-1">
                    <Button size="sm" variant="secondary" leftIcon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setEditor({ kind: 'edit', id: pkg.id })}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<Trash2 className="h-4 w-4" aria-hidden />}
                      onClick={() => {
                        setDeleting(pkg);
                        setDeleteError(null);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editor?.kind === 'new' && (
        <PackageEditor
          onClose={() => setEditor(null)}
          onCreated={() => {
            setEditor(null);
            loadPackages();
          }}
          onChanged={replacePackage}
        />
      )}
      {editing && <PackageEditor pkg={editing} onClose={() => setEditor(null)} onCreated={loadPackages} onChanged={replacePackage} />}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this package?"
        description={deleting ? `${deleting.name} and its tiers will be removed. Packages with bookings cannot be deleted.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void confirmDelete()}>
              Delete package
            </Button>
          </>
        }
      >
        {deleteError && (
          <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-body font-medium text-danger-fg">
            {deleteError}
          </p>
        )}
      </Modal>
    </>
  );
}
