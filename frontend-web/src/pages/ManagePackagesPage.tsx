import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../api/apiClient';
import {
  addTier,
  createPackage,
  deletePackage,
  getPackages,
  updatePackage,
  type ClassType,
  type PackageInput,
  type PackageTierInput,
  type TourPackage,
} from '../api/packages';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';

const CLASS_TYPES: ClassType[] = ['Normal', 'Second', 'First'];

function emptyTier(): PackageTierInput {
  return { classType: 'Normal', includesFood: false, basePricePerPerson: 0, requiresAC: false };
}

function emptyPackageForm(): PackageInput {
  return { name: '', theme: '', durationDays: 1, basePricePerPerson: 0, maxGroupSize: 1 };
}

function packageToForm(pkg: TourPackage): PackageInput {
  return {
    name: pkg.name,
    theme: pkg.theme,
    durationDays: pkg.durationDays,
    basePricePerPerson: pkg.basePricePerPerson,
    maxGroupSize: pkg.maxGroupSize,
  };
}

export function ManagePackagesPage() {
  const { user, logout } = useAuth();
  const [packages, setPackages] = useState<TourPackage[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<PackageInput>(emptyPackageForm());
  const [createTiers, setCreateTiers] = useState<PackageTierInput[]>([emptyTier()]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PackageInput>(emptyPackageForm());
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [newTierByPackage, setNewTierByPackage] = useState<Record<string, PackageTierInput>>({});
  const [tierErrorByPackage, setTierErrorByPackage] = useState<Record<string, string>>({});

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
    setCreating(true);
    try {
      await createPackage({ ...createForm, tiers: createTiers });
      setCreateForm(emptyPackageForm());
      setCreateTiers([emptyTier()]);
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
      await updatePackage(editingId, editForm);
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

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const labelClass = 'text-xs font-semibold text-slate-600';

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Logo className="h-7 w-auto" />
            <div className="border-l border-slate-200 pl-4">
              <h1 className="font-heading text-lg font-bold text-slate-900">Manage Packages</h1>
              <p className="text-sm text-slate-500">
                Signed in as <strong className="font-semibold text-slate-700">{user?.name}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Back to Dashboard
            </Link>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-10 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-heading text-lg font-bold text-slate-900">Create a new package</h2>
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
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className={labelClass}>Tiers</label>
                <button
                  type="button"
                  onClick={() => setCreateTiers((prev) => [...prev, emptyTier()])}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                >
                  + Add tier
                </button>
              </div>
              <div className="mt-2 space-y-3">
                {createTiers.map((tier, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-5 sm:items-center"
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
                    <label className="flex items-center gap-1.5 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={tier.includesFood}
                        onChange={(e) => updateCreateTier(index, { includesFood: e.target.checked })}
                      />
                      Food
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-slate-600">
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
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {createError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
                {createError}
              </p>
            )}

            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {creating ? 'Creating...' : 'Create package'}
            </button>
          </form>
        </section>

        <section>
          <h2 className="mb-4 font-heading text-lg font-bold text-slate-900">Existing packages</h2>

          {listError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {listError}
            </p>
          )}

          {packages === null && !listError && <p className="text-sm text-slate-500">Loading...</p>}

          {packages !== null && packages.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="font-medium text-slate-600">No tour packages yet.</p>
            </div>
          )}

          <div className="space-y-4">
            {packages?.map((pkg) => {
              const isEditing = editingId === pkg.id;
              const newTier = newTierByPackage[pkg.id] ?? emptyTier();
              const tierError = tierErrorByPackage[pkg.id];

              return (
                <article key={pkg.id} className="rounded-xl border border-slate-200 bg-white p-5">
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
                      {editError && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {editError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={savingEdit}
                          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                          {savingEdit ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-heading text-lg font-bold text-slate-900">{pkg.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {pkg.theme} · {pkg.durationDays} days · up to {pkg.maxGroupSize} travelers · $
                          {pkg.basePricePerPerson.toFixed(2)}/person
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(pkg)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(pkg.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                    {pkg.tiers.map((tier) => (
                      <li key={tier.id} className="flex items-center justify-between py-2 text-sm">
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
                          <span className="font-semibold text-slate-900">
                            ${tier.basePricePerPerson.toFixed(2)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
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
                    <label className="flex items-center gap-1.5 text-sm text-slate-600">
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
                    <label className="flex items-center gap-1.5 text-sm text-slate-600">
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
                      className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      + Add tier
                    </button>
                    {tierError && <p className="w-full text-xs font-medium text-red-700">{tierError}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
