import { useEffect, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { createDriver, deleteDriver, getDrivers, updateDriver, type DriverDto } from '../../api/vehicles';
import { IdCardIcon, PlusCircleIcon } from '../../components/admin/icons';

export function FleetDriversPage() {
  const [drivers, setDrivers] = useState<DriverDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search/filter
  const [searchTerm, setSearchTerm] = useState('');

  // Add Driver Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit Driver Modal
  const [editingDriver, setEditingDriver] = useState<DriverDto | null>(null);
  const [editName, setEditName] = useState('');
  const [editLicenseNumber, setEditLicenseNumber] = useState('');
  const [editContactInfo, setEditContactInfo] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Delete Driver Modal
  const [deletingDriver, setDeletingDriver] = useState<DriverDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadDrivers() {
    setError(null);
    getDrivers()
      .then((data) => setDrivers(data))
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load drivers.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDrivers();
  }, []);

  async function handleCreateDriver(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createDriver({
        name: name.trim(),
        licenseNumber: licenseNumber.trim(),
        contactInfo: contactInfo.trim(),
        email: email.trim() || undefined,
        password: password || undefined,
      });
      setName('');
      setLicenseNumber('');
      setContactInfo('');
      setEmail('');
      setPassword('');
      setShowModal(false);
      loadDrivers();
    } catch (err) {
      setCreateError(extractErrorMessage(err, 'Failed to register driver.'));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(driver: DriverDto) {
    setEditingDriver(driver);
    setEditName(driver.name);
    setEditLicenseNumber(driver.licenseNumber);
    setEditContactInfo(driver.contactInfo || '');
    setEditEmail(driver.email || '');
    setEditPassword('');
    setEditError(null);
  }

  async function handleUpdateDriver(e: FormEvent) {
    e.preventDefault();
    if (!editingDriver) return;
    setEditError(null);
    setUpdating(true);
    try {
      await updateDriver(editingDriver.id, {
        name: editName.trim(),
        licenseNumber: editLicenseNumber.trim(),
        contactInfo: editContactInfo.trim(),
        email: editEmail.trim() || undefined,
        password: editPassword || undefined,
      });
      setEditingDriver(null);
      loadDrivers();
    } catch (err) {
      setEditError(extractErrorMessage(err, 'Failed to update driver.'));
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteDriver() {
    if (!deletingDriver) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteDriver(deletingDriver.id);
      setDeletingDriver(null);
      loadDrivers();
    } catch (err) {
      setDeleteError(extractErrorMessage(err, 'Failed to delete driver.'));
    } finally {
      setDeleting(false);
    }
  }

  const filteredDrivers = drivers?.filter((d) => {
    const term = searchTerm.toLowerCase();
    return (
      d.name.toLowerCase().includes(term) ||
      d.licenseNumber.toLowerCase().includes(term) ||
      d.contactInfo.toLowerCase().includes(term)
    );
  });

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <IdCardIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-900">Driver Roster</h1>
            <p className="text-sm text-slate-500">
              Manage licensed drivers, contact numbers, and transport assignments.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <PlusCircleIcon className="h-4 w-4" />
          Register Driver
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Drivers</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{drivers?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Roster</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{drivers?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">License Verification</p>
          <p className="mt-2 text-2xl font-bold text-brand-600">100%</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search by name, license, contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={inputClass}
          />
        </div>
        <p className="text-xs text-slate-500">
          Showing {filteredDrivers?.length ?? 0} of {drivers?.length ?? 0} drivers
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Driver List Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-sm text-slate-500">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent mr-3" />
            Loading driver roster...
          </div>
        ) : filteredDrivers && filteredDrivers.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Driver Name</th>
                  <th className="px-4 py-3.5">License Number</th>
                  <th className="px-4 py-3.5">Contact Number</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Registered Date</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
                          {driver.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{driver.name}</p>
                          <p className="text-xs text-slate-400 font-mono">ID: {driver.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {driver.licenseNumber}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {driver.contactInfo || <span className="text-slate-400 italic">Not provided</span>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Available
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                      {driver.createdAt ? new Date(driver.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(driver)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-brand-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeletingDriver(driver);
                          }}
                          className="rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 shadow-xs transition hover:bg-rose-50 hover:text-rose-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-500">No drivers found.</p>
            <p className="mt-1 text-xs text-slate-400">Register a new driver above to assign them to vehicles.</p>
          </div>
        )}
      </div>

      {/* Add Driver Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-heading text-lg font-bold text-slate-900">Register New Driver</h3>
            <p className="mt-1 text-xs text-slate-500">
              Add a driver to the fleet roster for vehicle assignment and tour allocations.
            </p>

            <form onSubmit={handleCreateDriver} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Sunil Perera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">License Number</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. B-8492019"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Contact Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +94 77 123 4567"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Account Email (Optional Login)</label>
                <input
                  type="email"
                  placeholder="e.g. driver@trailwise.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Account Password (Optional Login)</label>
                <input
                  type="password"
                  placeholder="Min 6 characters (defaults to ChangeMe123!)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              {createError && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                  {createError}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {creating ? 'Saving...' : 'Register Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-heading text-lg font-bold text-slate-900">Update Driver Details</h3>
            <p className="mt-1 text-xs text-slate-500">
              Modify the driver name, license number, or phone contact information.
            </p>

            <form onSubmit={handleUpdateDriver} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Sunil Perera"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">License Number</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. B-8492019"
                  value={editLicenseNumber}
                  onChange={(e) => setEditLicenseNumber(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Contact Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +94 77 123 4567"
                  value={editContactInfo}
                  onChange={(e) => setEditContactInfo(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Account Email (Login)</label>
                <input
                  type="email"
                  placeholder="e.g. driver@trailwise.local"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">New Password (Leave blank to keep)</label>
                <input
                  type="password"
                  placeholder="Optional new password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              {editError && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                  {editError}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {updating ? 'Saving...' : 'Update Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Driver Confirmation Modal */}
      {deletingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-heading text-lg font-bold text-slate-900">Delete Driver</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to remove <strong className="text-slate-900">{deletingDriver.name}</strong> ({deletingDriver.licenseNumber}) from the fleet roster?
            </p>

            {deleteError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDriver(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteDriver}
                className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
