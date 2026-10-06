import { useState, type FormEvent } from 'react';
import { API_BASE_URL, extractErrorMessage } from '../../api/apiClient';
import { addTier, updatePackage, uploadPackagePhoto, type PackageInput, type PackageTierInput, type TourPackage } from '../../api/packages';
import { coordinatesForSubmit, namesNotOnMap } from '../packages/locationCoordinates';
import { LocationPicker } from '../packages/LocationPicker';
import { TierFields } from '../packages/TierFields';
import { Badge, Button, Card, Input } from '../ui';
import { emptyTier } from './PackageCreateForm';

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

interface AdminPackageCardProps {
  pkg: TourPackage;
  onChanged: () => void;
  onDelete: (id: string) => void;
}

/** One existing package: summary or inline edit form, its tiers, an add-tier row and photo upload. */
export function AdminPackageCard({ pkg, onChanged, onDelete }: AdminPackageCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<PackageInput>(packageToForm(pkg));
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [newTier, setNewTier] = useState<PackageTierInput>(emptyTier());
  const [tierError, setTierError] = useState('');

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  function startEdit() {
    setEditForm(packageToForm(pkg));
    setEditError(null);
    setIsEditing(true);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    setEditError(null);
    setSavingEdit(true);
    try {
      await updatePackage(pkg.id, {
        ...editForm,
        locationCoordinates: coordinatesForSubmit(pkg, editForm.locationNames),
      });
      setIsEditing(false);
      onChanged();
    } catch (err) {
      setEditError(extractErrorMessage(err, 'Could not update package.'));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleAddTier() {
    setTierError('');
    try {
      await addTier(pkg.id, newTier);
      setNewTier(emptyTier());
      onChanged();
    } catch (err) {
      setTierError(extractErrorMessage(err, 'Could not add tier.'));
    }
  }

  async function handleUploadPhoto(file: File) {
    setPhotoError('');
    setUploadingPhoto(true);
    try {
      await uploadPackagePhoto(pkg.id, file);
      onChanged();
    } catch (err) {
      setPhotoError(extractErrorMessage(err, 'Could not upload photo.'));
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <Card className="transition hover:shadow-raised">
      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input aria-label="Name" required value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            <Input aria-label="Theme" required value={editForm.theme} onChange={(e) => setEditForm((f) => ({ ...f, theme: e.target.value }))} />
            <Input
              aria-label="Duration (days)"
              required
              type="number"
              min={1}
              value={editForm.durationDays}
              onChange={(e) => setEditForm((f) => ({ ...f, durationDays: Number(e.target.value) }))}
            />
            <Input
              aria-label="Max group size"
              required
              type="number"
              min={1}
              value={editForm.maxGroupSize}
              onChange={(e) => setEditForm((f) => ({ ...f, maxGroupSize: Number(e.target.value) }))}
            />
            <Input
              aria-label="Base price per person"
              required
              type="number"
              min={0.01}
              step="0.01"
              value={editForm.basePricePerPerson}
              onChange={(e) => setEditForm((f) => ({ ...f, basePricePerPerson: Number(e.target.value) }))}
            />
          </div>
          <div>
            <p className="mb-2 text-caption font-semibold text-fg">Locations visited</p>
            <LocationPicker
              selected={editForm.locationNames}
              notOnMap={namesNotOnMap(pkg)}
              onChange={(next) => setEditForm((f) => ({ ...f, locationNames: next }))}
            />
          </div>
          {editError && (
            <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-fg">
              {editError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={savingEdit}>
              {savingEdit ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {pkg.photoUrl ? (
              <img src={`${API_BASE_URL}${pkg.photoUrl}`} alt={pkg.name} className="h-16 w-24 shrink-0 rounded-input object-cover" />
            ) : (
              <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-input bg-neutral-soft text-caption text-fg-muted">
                No photo
              </div>
            )}
            <div>
              <h3 className="font-heading text-h3 text-fg">{pkg.name}</h3>
              <p className="mt-1 text-body text-fg-muted">
                {pkg.theme} · {pkg.durationDays} days · up to {pkg.maxGroupSize} travelers · ${pkg.basePricePerPerson.toFixed(2)}/person
              </p>
              {pkg.locations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pkg.locations.map((loc) => (
                    <Badge key={loc.id}>{loc.name}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" onClick={startEdit}>
              Edit
            </Button>
            <Button size="sm" variant="secondary" className="border-danger/30 text-danger-fg" onClick={() => onDelete(pkg.id)}>
              Delete
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-4 divide-y divide-border border-t border-border">
        {pkg.tiers.map((tier) => (
          <li key={tier.id} className="flex items-center justify-between py-2 text-body">
            <span className="font-medium text-fg">{tier.classType}</span>
            <span className="flex items-center gap-1.5">
              {tier.includesFood && <Badge tone="brand">food</Badge>}
              {tier.requiresAC && <Badge>AC</Badge>}
              <span className="font-semibold text-fg">${tier.basePricePerPerson.toFixed(2)}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-input bg-surface-sunken p-3">
        <TierFields value={newTier} onChange={(patch) => setNewTier((prev) => ({ ...prev, ...patch }))} />
        <Button size="sm" variant="secondary" onClick={handleAddTier}>
          + Add tier
        </Button>
        {tierError && <p className="w-full text-caption font-medium text-danger-fg">{tierError}</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-input bg-surface-sunken p-3">
        <label className="cursor-pointer rounded-input border border-brand-500/30 bg-brand-soft px-3 py-1.5 text-caption font-semibold text-brand-text hover:opacity-90">
          {uploadingPhoto ? 'Uploading...' : pkg.photoUrl ? 'Replace photo' : 'Upload photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploadingPhoto}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleUploadPhoto(file);
              }
              e.target.value = '';
            }}
          />
        </label>
        {photoError && <p className="w-full text-caption font-medium text-danger-fg">{photoError}</p>}
      </div>
    </Card>
  );
}
