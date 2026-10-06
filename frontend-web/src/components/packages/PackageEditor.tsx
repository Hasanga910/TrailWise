import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ImagePlus, Plus, X } from 'lucide-react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  createPackage,
  updatePackage,
  uploadPackagePhoto,
  type PackageInput,
  type PackageTierInput,
  type TourPackage,
} from '../../api/packages';
import { buttonClasses } from '../ui/buttonStyles';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { Input } from '../ui/Input';
import { notify } from '../ui/notify';
import { PackagePhoto } from '../explorer/packagePhoto';
import { LocationPicker } from './LocationPicker';
import { coordinatesForSubmit, namesNotOnMap } from './locationCoordinates';
import { TierFields } from './TierFields';
import { emptyTier, hasDuplicateTier } from './tierHelpers';
import { TierTable } from './TierTable';

function emptyPackageForm(): PackageInput {
  return { name: '', theme: '', durationDays: 1, basePricePerPerson: 0, maxGroupSize: 1, locationNames: [] };
}

function packageToForm(pkg: TourPackage): PackageInput {
  return {
    name: pkg.name,
    theme: pkg.theme,
    durationDays: pkg.durationDays,
    basePricePerPerson: pkg.basePricePerPerson,
    maxGroupSize: pkg.maxGroupSize,
    locationNames: pkg.locations.map((l) => l.name),
  };
}

const ErrorText = ({ children }: { children: string }) => (
  <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-body font-medium text-danger-fg">
    {children}
  </p>
);

function DetailFields({ form, setForm }: { form: PackageInput; setForm: (update: (f: PackageInput) => PackageInput) => void }) {
  return (
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
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<PackageInput>(emptyPackageForm());
  const [tiers, setTiers] = useState<PackageTierInput[]>([emptyTier()]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (hasDuplicateTier(tiers)) {
      setError('Two tiers cannot share the same class and food option.');
      return;
    }
    setSaving(true);
    try {
      const created = await createPackage({ ...form, tiers });
      if (photo) {
        try {
          await uploadPackagePhoto(created.id, photo);
        } catch (photoErr) {
          notify.warning(extractErrorMessage(photoErr, 'Package was created, but the photo could not be uploaded.'));
        }
      }
      notify.success('Package created.', created.name);
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not create package.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-5">
      <DetailFields form={form} setForm={setForm} />

      <div className="space-y-2">
        <Input
          label="Photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        {previewUrl && <img src={previewUrl} alt="Preview" className="h-20 w-32 rounded-input object-cover" />}
      </div>

      <div className="space-y-2">
        <p className="text-caption font-semibold text-fg">Locations visited</p>
        <LocationPicker selected={form.locationNames} onChange={(next) => setForm((f) => ({ ...f, locationNames: next }))} />
      </div>

      <section aria-label="Tiers" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-h4 text-fg">Tiers</h3>
          <Button size="sm" variant="secondary" leftIcon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setTiers((prev) => [...prev, emptyTier()])}>
            Add tier
          </Button>
        </div>
        {tiers.map((tier, index) => (
          <div key={index} className="flex items-start gap-2 rounded-card border border-border p-3">
            <div className="min-w-0 flex-1">
              <TierFields value={tier} onChange={(patch) => setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)))} />
            </div>
            {tiers.length > 1 && (
              <Button size="sm" variant="ghost" aria-label={`Remove tier ${index + 1}`} onClick={() => setTiers((prev) => prev.filter((_, i) => i !== index))}>
                <X className="h-4 w-4" aria-hidden />
                Remove
              </Button>
            )}
          </div>
        ))}
      </section>

      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" loading={saving}>
        {saving ? 'Creating...' : 'Create package'}
      </Button>
    </form>
  );
}

function EditForm({ pkg, onChanged }: { pkg: TourPackage; onChanged: (pkg: TourPackage) => void }) {
  const [form, setForm] = useState<PackageInput>(packageToForm(pkg));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await updatePackage(pkg.id, {
        ...form,
        locationCoordinates: coordinatesForSubmit(pkg, form.locationNames),
      });
      onChanged(updated);
      notify.success('Package details saved.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not update package.'));
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(file: File) {
    setPhotoError(null);
    setUploading(true);
    try {
      onChanged(await uploadPackagePhoto(pkg.id, file));
      notify.success('Photo updated.');
    } catch (err) {
      setPhotoError(extractErrorMessage(err, 'Could not upload photo.'));
    } finally {
      setUploading(false);
    }
  }

  const photoLabel = uploading ? 'Uploading...' : pkg.photoUrl ? 'Replace photo' : 'Upload photo';

  return (
    <div className="space-y-8 p-5">
      <form onSubmit={handleSave} aria-label="Package details" className="space-y-6">
        <div className="flex items-center gap-4">
          <PackagePhoto pkg={pkg} className="h-20 w-32 shrink-0 rounded-input" />
          <div className="space-y-1.5">
            <label className={`${buttonClasses('secondary', 'sm')} cursor-pointer`}>
              <ImagePlus className="h-4 w-4" aria-hidden />
              {photoLabel}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label={photoLabel}
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handlePhoto(file);
                  e.target.value = '';
                }}
              />
            </label>
            {photoError && <p role="alert" className="text-caption font-medium text-danger">{photoError}</p>}
          </div>
        </div>

        <DetailFields form={form} setForm={setForm} />

        <div className="space-y-2">
          <p className="text-caption font-semibold text-fg">Locations visited</p>
          <LocationPicker
            selected={form.locationNames}
            notOnMap={namesNotOnMap(pkg)}
            onChange={(next) => setForm((f) => ({ ...f, locationNames: next }))}
          />
        </div>

        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit" loading={saving}>
          {saving ? 'Saving...' : 'Save details'}
        </Button>
      </form>

      <TierTable pkg={pkg} onChanged={onChanged} />
    </div>
  );
}

/** One screen for a package and its tiers: create a new package, or edit details and tier configuration. */
export function PackageEditor({
  pkg,
  onClose,
  onCreated,
  onChanged,
}: {
  /** The package being edited; omit to create a new one. */
  pkg?: TourPackage;
  onClose: () => void;
  onCreated: () => void;
  onChanged: (pkg: TourPackage) => void;
}) {
  return (
    <Drawer open onClose={onClose} title={pkg ? `Edit ${pkg.name}` : 'New package'} className="w-[min(42rem,100vw)]">
      {pkg ? <EditForm pkg={pkg} onChanged={onChanged} /> : <CreateForm onCreated={onCreated} />}
    </Drawer>
  );
}
