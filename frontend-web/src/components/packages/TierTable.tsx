import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { extractErrorMessage } from '../../api/apiClient';
import { addTier, deleteTier, updateTier, type PackageTier, type PackageTierInput, type TourPackage } from '../../api/packages';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { notify } from '../ui/notify';
import { TierFields } from './TierFields';
import { emptyTier, money, sortTiers, tierToInput } from './tierHelpers';

/** Live tier configuration for an existing package: add, edit and delete tiers, each saved on its own. */
export function TierTable({ pkg, onChanged }: { pkg: TourPackage; onChanged: (pkg: TourPackage) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PackageTierInput>(emptyTier());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTier, setNewTier] = useState<PackageTierInput>(emptyTier());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<TourPackage>, failure: string, success: string, done: () => void) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await action());
      notify.success(success);
      done();
    } catch (err) {
      setError(extractErrorMessage(err, failure));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(tier: PackageTier) {
    setEditingId(tier.id);
    setDraft(tierToInput(tier));
    setConfirmingId(null);
    setAdding(false);
    setError(null);
  }

  const tiers = sortTiers(pkg.tiers);

  return (
    <section aria-label="Tiers" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-h4 text-fg">Tiers</h3>
        {!adding && (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() => {
              setAdding(true);
              setEditingId(null);
              setNewTier(emptyTier());
              setError(null);
            }}
          >
            Add tier
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-body font-medium text-danger-fg">
          {error}
        </p>
      )}

      <ul className="divide-y divide-border rounded-card border border-border">
        {tiers.map((tier) => (
          <li key={tier.id} className="p-3">
            {editingId === tier.id ? (
              <form
                aria-label={`Edit ${tier.classType} tier`}
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => updateTier(pkg.id, tier.id, draft), 'Could not save the tier.', 'Tier saved.', () => setEditingId(null));
                }}
              >
                <TierFields value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" loading={busy}>
                    Save tier
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-fg">{tier.classType}</span>
                  <Badge tone={tier.includesFood ? 'brand' : 'neutral'}>{tier.includesFood ? 'Food included' : 'No food'}</Badge>
                  <Badge tone={tier.requiresAC ? 'info' : 'neutral'}>{tier.requiresAC ? 'AC required' : 'No AC needed'}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-h4 text-fg">{money(tier.basePricePerPerson)}</span>
                  <span className="text-caption text-fg-muted">/person</span>
                  {confirmingId === tier.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={busy}
                        onClick={() =>
                          void run(() => deleteTier(pkg.id, tier.id), 'Could not delete the tier.', 'Tier deleted.', () => setConfirmingId(null))
                        }
                      >
                        Confirm delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <>
                      <IconButton label={`Edit ${tier.classType} tier`} size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => startEdit(tier)} />
                      <IconButton
                        label={`Delete ${tier.classType} tier`}
                        size="sm"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => {
                          setConfirmingId(tier.id);
                          setEditingId(null);
                          setError(null);
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
        {adding && (
          <li className="bg-surface-sunken p-3">
            <form
              aria-label="New tier"
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => addTier(pkg.id, newTier), 'Could not add the tier.', 'Tier added.', () => setAdding(false));
              }}
            >
              <TierFields value={newTier} onChange={(patch) => setNewTier((t) => ({ ...t, ...patch }))} />
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={busy}>
                  Add this tier
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </li>
        )}
      </ul>
      <p className="text-caption text-fg-muted">
        Each class can have one tier with food and one without. A tier that already has bookings, or a package's last tier, cannot be deleted.
      </p>
    </section>
  );
}
