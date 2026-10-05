import { useEffect, useState, type FormEvent } from 'react';
import { extractErrorMessage, API_BASE_URL } from '../../api/apiClient';
import { searchLocations, type LocationSuggestion } from '../../api/locations';
import { coordinatesForSubmit, isNotOnMap, namesNotOnMap } from '../../components/packages/locationCoordinates';
import {
  addTier,
  createPackage,
  deletePackage,
  getPackages,
  updatePackage,
  uploadPackagePhoto,
  type ClassType,
  type PackageInput,
  type PackageTierInput,
  type TourPackage,
} from '../../api/packages';
import { PackagesIcon, PlusCircleIcon } from '../../components/admin/icons';

const CLASS_TYPES: ClassType[] = ['Normal', 'Second', 'First'];

const inputClass =
  'w-full rounded-lg border border-border px-3 py-2 text-sm text-fg focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const labelClass = 'text-xs font-semibold text-fg-muted';

function LocationPicker({
  selected,
  onChange,
  notOnMap,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  /** Existing locations the map can't place yet (full map editing arrives with the itinerary builder). */
  notOnMap?: ReadonlySet<string>;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }
    const timeout = setTimeout(() => {
      searchLocations(trimmed)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 600);
    return () => clearTimeout(timeout);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSearching(value.trim().length >= 2);
  }

  function addLocation(name: string) {
    const trimmed = name.trim();
    if (!trimmed || selected.includes(trimmed)) {
      return;
    }
    onChange([...selected, trimmed]);
    setQuery('');
    setSuggestions([]);
  }

  function removeLocation(name: string) {
    onChange(selected.filter((l) => l !== name));
  }

  const trimmedQuery = query.trim();
  const visibleSuggestions = trimmedQuery.length >= 2 ? suggestions : [];
  const hasExactMatch = visibleSuggestions.some((s) => s.name.toLowerCase() === trimmedQuery.toLowerCase());

  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-text"
            >
              {name}
              {isNotOnMap(notOnMap, name) && (
                <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning-fg" title="This place isn't on the public map yet. We retry when the package is saved.">
                  Not on map
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => removeLocation(name)}
                className="text-brand-text hover:text-brand-text"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          className={inputClass}
          placeholder="Search for a location..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />
        {trimmedQuery.length >= 2 && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-surface-raised shadow-lg">
            {searching && <p className="px-3 py-2 text-xs text-fg-muted">Searching...</p>}
            {!searching &&
              visibleSuggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => addLocation(s.name)}
                  className="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface-sunken"
                >
                  {s.name}
                </button>
              ))}
            {!searching && !hasExactMatch && (
              <button
                type="button"
                onClick={() => addLocation(trimmedQuery)}
                className="block w-full px-3 py-2 text-left text-sm font-medium text-brand-text hover:bg-brand-soft"
              >
                Add &quot;{trimmedQuery}&quot; as typed
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function emptyTier(): PackageTierInput {
  return { classType: 'Normal', includesFood: false, basePricePerPerson: 0, requiresAC: false };
}

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

export function PackagesOverviewPage() {
  const [packages, setPackages] = useState<TourPackage[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<PackageInput>(emptyPackageForm());
  const [createTiers, setCreateTiers] = useState<PackageTierInput[]>([emptyTier()]);
  const [createPhotoFile, setCreatePhotoFile] = useState<File | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createWarning, setCreateWarning] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PackageInput>(emptyPackageForm());
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [newTierByPackage, setNewTierByPackage] = useState<Record<string, PackageTierInput>>({});
  const [tierErrorByPackage, setTierErrorByPackage] = useState<Record<string, string>>({});

  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const [photoErrorByPackage, setPhotoErrorByPackage] = useState<Record<string, string>>({});

  function loadPackages() {
    getPackages()
      .then(setPackages)
      .catch((err) => setListError(extractErrorMessage(err, 'Could not load tour packages.')));
  }

  useEffect(() => {
    loadPackages();
  }, []);

  function updateCreateTier(index: number, patch: Partial<PackageTierInput>) {
    setCreateTiers((prev) => prev.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateWarning(null);
    setCreating(true);
    try {
      const created = await createPackage({ ...createForm, tiers: createTiers });
      if (createPhotoFile) {
        try {
          await uploadPackagePhoto(created.id, createPhotoFile);
        } catch (photoErr) {
          setCreateWarning(
            extractErrorMessage(photoErr, 'Package was created, but the photo could not be uploaded.'),
          );
        }
      }
      setCreateForm(emptyPackageForm());
      setCreateTiers([emptyTier()]);
      setCreatePhotoFile(null);
      loadPackages();
    } catch (err) {
      setCreateError(extractErrorMessage(err, 'Could not create package.'));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(pkg: TourPackage) {
    setEditingId(pkg.id);
    setEditForm(packageToForm(pkg));
    setEditError(null);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) {
      return;
    }
    setEditError(null);
    setSavingEdit(true);
    try {
      await updatePackage(editingId, {
        ...editForm,
        locationCoordinates: coordinatesForSubmit(packages?.find((p) => p.id === editingId), editForm.locationNames),
      });
      setEditingId(null);
      loadPackages();
    } catch (err) {
      setEditError(extractErrorMessage(err, 'Could not update package.'));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    setListError(null);
    try {
      await deletePackage(id);
      loadPackages();
    } catch (err) {
      setListError(extractErrorMessage(err, 'Could not delete package.'));
    }
  }

  async function handleAddTier(packageId: string) {
    const tier = newTierByPackage[packageId] ?? emptyTier();
    setTierErrorByPackage((prev) => ({ ...prev, [packageId]: '' }));
    try {
      await addTier(packageId, tier);
      setNewTierByPackage((prev) => ({ ...prev, [packageId]: emptyTier() }));
      loadPackages();
    } catch (err) {
      setTierErrorByPackage((prev) => ({
        ...prev,
        [packageId]: extractErrorMessage(err, 'Could not add tier.'),
      }));
    }
  }

  async function handleUploadPhoto(packageId: string, file: File) {
    setPhotoErrorByPackage((prev) => ({ ...prev, [packageId]: '' }));
    setUploadingPhotoId(packageId);
    try {
      await uploadPackagePhoto(packageId, file);
      loadPackages();
    } catch (err) {
      setPhotoErrorByPackage((prev) => ({
        ...prev,
        [packageId]: extractErrorMessage(err, 'Could not upload photo.'),
      }));
    } finally {
      setUploadingPhotoId(null);
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-brand-soft to-surface-raised p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
          <PackagesIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-bold text-fg">Package management</h1>
          <p className="text-sm text-fg-muted">
            {packages ? `${packages.length} ${packages.length === 1 ? 'package' : 'packages'} configured` : 'Loading packages…'}
          </p>
        </div>
      </div>

      <section className="mb-10 rounded-xl border border-border bg-surface-raised p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <PlusCircleIcon className="h-5 w-5 text-brand-text" />
          <h2 className="font-heading text-lg font-bold text-fg">Create a new package</h2>
        </div>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Name</label>
              <input
                required
                className={inputClass}
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Theme</label>
              <input
                required
                className={inputClass}
                value={createForm.theme}
                onChange={(e) => setCreateForm((f) => ({ ...f, theme: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Duration (days)</label>
              <input
                required
                type="number"
                min={1}
                className={inputClass}
                value={createForm.durationDays}
                onChange={(e) => setCreateForm((f) => ({ ...f, durationDays: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className={labelClass}>Max group size</label>
              <input
                required
                type="number"
                min={1}
                className={inputClass}
                value={createForm.maxGroupSize}
                onChange={(e) => setCreateForm((f) => ({ ...f, maxGroupSize: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className={labelClass}>Base price per person</label>
              <input
                required
                type="number"
                min={0.01}
                step="0.01"
                className={inputClass}
                value={createForm.basePricePerPerson}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, basePricePerPerson: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <label className={labelClass}>Photo</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={inputClass}
                onChange={(e) => setCreatePhotoFile(e.target.files?.[0] ?? null)}
              />
              {createPhotoFile && (
                <img
                  src={URL.createObjectURL(createPhotoFile)}
                  alt="Preview"
                  className="mt-2 h-20 w-32 rounded-lg object-cover"
                />
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Locations visited</label>
            <div className="mt-2">
              <LocationPicker
                selected={createForm.locationNames}
                onChange={(next) => setCreateForm((f) => ({ ...f, locationNames: next }))}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className={labelClass}>Tiers</label>
              <button
                type="button"
                onClick={() => setCreateTiers((prev) => [...prev, emptyTier()])}
                className="text-xs font-semibold text-brand-text hover:text-brand-fg"
              >
                + Add tier
              </button>
            </div>
            <div className="mt-2 space-y-3">
              {createTiers.map((tier, index) => (
                <div
                  key={index}
                  className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 sm:grid-cols-5 sm:items-center"
                >
                  <select
                    className={inputClass}
                    value={tier.classType}
                    onChange={(e) => updateCreateTier(index, { classType: e.target.value as ClassType })}
                  >
                    {CLASS_TYPES.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    type="number"
                    min={0.01}
                    step="0.01"
                    placeholder="Price"
                    className={inputClass}
                    value={tier.basePricePerPerson}
                    onChange={(e) => updateCreateTier(index, { basePricePerPerson: Number(e.target.value) })}
                  />
                  <label className="flex items-center gap-1.5 text-sm text-fg-muted">
                    <input
                      type="checkbox"
                      checked={tier.includesFood}
                      onChange={(e) => updateCreateTier(index, { includesFood: e.target.checked })}
                    />
                    Food
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-fg-muted">
                    <input
                      type="checkbox"
                      checked={tier.requiresAC}
                      onChange={(e) => updateCreateTier(index, { requiresAC: e.target.checked })}
                    />
                    AC
                  </label>
                  {createTiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setCreateTiers((prev) => prev.filter((_, i) => i !== index))}
                      className="text-xs font-semibold text-danger hover:text-danger-fg"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {createError && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-2 text-sm font-medium text-danger-fg">
              {createError}
            </p>
          )}
          {createWarning && (
            <p className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-2 text-sm font-medium text-warning-fg">
              {createWarning}
            </p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
          >
            {creating ? 'Creating...' : 'Create package'}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <PackagesIcon className="h-5 w-5 text-fg-muted" />
          <h2 className="font-heading text-lg font-bold text-fg">Existing packages</h2>
        </div>

        {listError && (
          <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-fg">
            {listError}
          </p>
        )}

        {packages === null && !listError && (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-surface-raised" />
            ))}
          </div>
        )}

        {packages !== null && packages.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-text">
              <PackagesIcon className="h-6 w-6" />
            </div>
            <p className="mt-3 font-medium text-fg-muted">No tour packages yet.</p>
            <p className="mt-1 text-sm text-fg-muted">Use the form above to create the first one.</p>
          </div>
        )}

        <div className="space-y-4">
          {packages?.map((pkg) => {
            const isEditing = editingId === pkg.id;
            const newTier = newTierByPackage[pkg.id] ?? emptyTier();
            const tierError = tierErrorByPackage[pkg.id];
            const photoError = photoErrorByPackage[pkg.id];

            return (
              <article
                key={pkg.id}
                className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm transition hover:shadow-md"
              >
                {isEditing ? (
                  <form onSubmit={handleSaveEdit} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        required
                        className={inputClass}
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                      <input
                        required
                        className={inputClass}
                        value={editForm.theme}
                        onChange={(e) => setEditForm((f) => ({ ...f, theme: e.target.value }))}
                      />
                      <input
                        required
                        type="number"
                        min={1}
                        className={inputClass}
                        value={editForm.durationDays}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, durationDays: Number(e.target.value) }))
                        }
                      />
                      <input
                        required
                        type="number"
                        min={1}
                        className={inputClass}
                        value={editForm.maxGroupSize}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, maxGroupSize: Number(e.target.value) }))
                        }
                      />
                      <input
                        required
                        type="number"
                        min={0.01}
                        step="0.01"
                        className={inputClass}
                        value={editForm.basePricePerPerson}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, basePricePerPerson: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Locations visited</label>
                      <div className="mt-2">
                        <LocationPicker
                          selected={editForm.locationNames}
                          notOnMap={namesNotOnMap(packages?.find((p) => p.id === editingId))}
                          onChange={(next) => setEditForm((f) => ({ ...f, locationNames: next }))}
                        />
                      </div>
                    </div>
                    {editError && (
                      <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-fg">
                        {editError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                      >
                        {savingEdit ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-sunken"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {pkg.photoUrl ? (
                        <img
                          src={`${API_BASE_URL}${pkg.photoUrl}`}
                          alt={pkg.name}
                          className="h-16 w-24 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-neutral-soft text-[11px] text-fg-muted">
                          No photo
                        </div>
                      )}
                      <div>
                        <h3 className="font-heading text-lg font-bold text-fg">{pkg.name}</h3>
                        <p className="mt-1 text-sm text-fg-muted">
                          {pkg.theme} · {pkg.durationDays} days · up to {pkg.maxGroupSize} travelers · $
                          {pkg.basePricePerPerson.toFixed(2)}/person
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
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => startEdit(pkg)}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-fg hover:bg-surface-sunken"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(pkg.id)}
                        className="rounded-lg border border-danger/30 px-3 py-1.5 text-sm font-semibold text-danger-fg hover:bg-danger-soft"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <ul className="mt-4 divide-y divide-border border-t border-border">
                  {pkg.tiers.map((tier) => (
                    <li key={tier.id} className="flex items-center justify-between py-2 text-sm">
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
                        <span className="font-semibold text-fg">
                          ${tier.basePricePerPerson.toFixed(2)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-sunken p-3">
                  <select
                    className={`${inputClass} w-auto`}
                    value={newTier.classType}
                    onChange={(e) =>
                      setNewTierByPackage((prev) => ({
                        ...prev,
                        [pkg.id]: { ...newTier, classType: e.target.value as ClassType },
                      }))
                    }
                  >
                    {CLASS_TYPES.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    placeholder="Price"
                    className={`${inputClass} w-28`}
                    value={newTier.basePricePerPerson}
                    onChange={(e) =>
                      setNewTierByPackage((prev) => ({
                        ...prev,
                        [pkg.id]: { ...newTier, basePricePerPerson: Number(e.target.value) },
                      }))
                    }
                  />
                  <label className="flex items-center gap-1.5 text-sm text-fg-muted">
                    <input
                      type="checkbox"
                      checked={newTier.includesFood}
                      onChange={(e) =>
                        setNewTierByPackage((prev) => ({
                          ...prev,
                          [pkg.id]: { ...newTier, includesFood: e.target.checked },
                        }))
                      }
                    />
                    Food
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-fg-muted">
                    <input
                      type="checkbox"
                      checked={newTier.requiresAC}
                      onChange={(e) =>
                        setNewTierByPackage((prev) => ({
                          ...prev,
                          [pkg.id]: { ...newTier, requiresAC: e.target.checked },
                        }))
                      }
                    />
                    AC
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddTier(pkg.id)}
                    className="rounded-lg border border-brand-500/30 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-text hover:bg-brand-soft"
                  >
                    + Add tier
                  </button>
                  {tierError && <p className="w-full text-xs font-medium text-danger-fg">{tierError}</p>}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-sunken p-3">
                  <label className="cursor-pointer rounded-lg border border-brand-500/30 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-text hover:bg-brand-soft">
                    {uploadingPhotoId === pkg.id ? 'Uploading...' : pkg.photoUrl ? 'Replace photo' : 'Upload photo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploadingPhotoId === pkg.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleUploadPhoto(pkg.id, file);
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {photoError && <p className="w-full text-xs font-medium text-danger-fg">{photoError}</p>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
