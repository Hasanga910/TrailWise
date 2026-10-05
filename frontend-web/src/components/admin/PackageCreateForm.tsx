import { useMemo, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { createPackage, uploadPackagePhoto, type PackageInput, type PackageTierInput } from '../../api/packages';
import { LocationPicker } from '../packages/LocationPicker';
import { TierFields } from '../packages/TierFields';
import { Button, Card, Input } from '../ui';
import { PlusCircleIcon } from './icons';

export function emptyTier(): PackageTierInput {
  return { classType: 'Normal', includesFood: false, basePricePerPerson: 0, requiresAC: false };
}

export function emptyPackageForm(): PackageInput {
  return { name: '', theme: '', durationDays: 1, basePricePerPerson: 0, maxGroupSize: 1, locationNames: [] };
}

/** "Create a new package" form: details, optional photo, locations and one or more tiers. */
export function PackageCreateForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<PackageInput>(emptyPackageForm());
  const [tiers, setTiers] = useState<PackageTierInput[]>([emptyTier()]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const previewUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile]);

  function updateTier(index: number, patch: Partial<PackageTierInput>) {
    setTiers((prev) => prev.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setCreating(true);
    try {
      const created = await createPackage({ ...form, tiers });
      if (photoFile) {
        try {
          await uploadPackagePhoto(created.id, photoFile);
        } catch (photoErr) {
          setWarning(extractErrorMessage(photoErr, 'Package was created, but the photo could not be uploaded.'));
        }
      }
      setForm(emptyPackageForm());
      setTiers([emptyTier()]);
      setPhotoFile(null);
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not create package.'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="mb-10 p-6">
      <div className="flex items-center gap-2">
        <PlusCircleIcon className="h-5 w-5 text-brand-text" />
        <h2 className="font-heading text-h3 text-fg">Create a new package</h2>
      </div>
      <form onSubmit={handleCreate} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Theme" required value={form.theme} onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))} />
          <Input
            label="Duration (days)"
            required
            type="number"
            min={1}
            value={form.durationDays}
            onChange={(e) => setForm((f) => ({ ...f, durationDays: Number(e.target.value) }))}
          />
          <Input
            label="Max group size"
            required
            type="number"
            min={1}
            value={form.maxGroupSize}
            onChange={(e) => setForm((f) => ({ ...f, maxGroupSize: Number(e.target.value) }))}
          />
          <Input
            label="Base price per person"
            required
            type="number"
            min={0.01}
            step="0.01"
            value={form.basePricePerPerson}
            onChange={(e) => setForm((f) => ({ ...f, basePricePerPerson: Number(e.target.value) }))}
          />
          <div>
            <Input
              label="Photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
            {previewUrl && <img src={previewUrl} alt="Preview" className="mt-2 h-20 w-32 rounded-input object-cover" />}
          </div>
        </div>

        <div>
          <p className="mb-2 text-caption font-semibold text-fg">Locations visited</p>
          <LocationPicker selected={form.locationNames} onChange={(next) => setForm((f) => ({ ...f, locationNames: next }))} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-caption font-semibold text-fg">Tiers</p>
            <Button variant="ghost" size="sm" onClick={() => setTiers((prev) => [...prev, emptyTier()])}>
              + Add tier
            </Button>
          </div>
          <div className="mt-2 space-y-3">
            {tiers.map((tier, index) => (
              <div key={index} className="flex flex-wrap items-center gap-3 rounded-input border border-border p-3">
                <TierFields value={tier} onChange={(patch) => updateTier(index, patch)} />
                {tiers.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger-fg hover:text-danger-fg"
                    onClick={() => setTiers((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-4 py-2 text-body font-medium text-danger-fg">
            {error}
          </p>
        )}
        {warning && (
          <p className="rounded-input border border-warning/30 bg-warning-soft px-4 py-2 text-body font-medium text-warning-fg">
            {warning}
          </p>
        )}

        <Button type="submit" disabled={creating}>
          {creating ? 'Creating...' : 'Create package'}
        </Button>
      </form>
    </Card>
  );
}
