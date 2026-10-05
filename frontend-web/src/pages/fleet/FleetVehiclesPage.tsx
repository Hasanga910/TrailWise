import { useEffect, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  createVehicle,
  deleteVehicle,
  getVehicles,
  updateVehicleMaintenanceStatus,
  type VehicleDto,
  type VehicleMaintenanceStatus,
  type VehicleType,
} from '../../api/vehicles';
import { PlusCircleIcon, TruckIcon } from '../../components/admin/icons';
import { StatusBadge, VehicleTypeBadge } from '../../components/fleet/FleetManager';
import { notify } from '../../components/ui/notify';

export function FleetVehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAC, setFilterAC] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Register Vehicle Modal
  const [showModal, setShowModal] = useState(false);
  const [regNumber, setRegNumber] = useState('');
  const [vehType, setVehType] = useState<VehicleType>('Van');
  const [capacity, setCapacity] = useState<number>(8);
  const [hasAC, setHasAC] = useState(true);
  const [seatConfig, setSeatConfig] = useState('2-2-2-2');
  const [initialStatus, setInitialStatus] = useState<VehicleMaintenanceStatus>('Available');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Status updating state per vehicle id
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Delete Vehicle Modal
  const [deletingVehicle, setDeletingVehicle] = useState<VehicleDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadVehicles() {
    setError(null);
    getVehicles()
      .then((data) => setVehicles(data))
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load fleet vehicles.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  async function handleCreateVehicle(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createVehicle({
        registrationNumber: regNumber.trim().toUpperCase(),
        type: vehType,
        capacity: Number(capacity),
        hasAC,
        seatConfiguration: seatConfig.trim() || undefined,
        maintenanceStatus: initialStatus,
      });
      setRegNumber('');
      setVehType('Van');
      setCapacity(8);
      setHasAC(true);
      setSeatConfig('2-2-2-2');
      setInitialStatus('Available');
      setShowModal(false);
      loadVehicles();
    } catch (err) {
      setCreateError(extractErrorMessage(err, 'Failed to register vehicle.'));
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(vehicleId: string, newStatus: VehicleMaintenanceStatus) {
    setUpdatingId(vehicleId);
    try {
      await updateVehicleMaintenanceStatus(vehicleId, { status: newStatus });
      loadVehicles();
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Failed to update vehicle status.'));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeleteVehicle() {
    if (!deletingVehicle) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteVehicle(deletingVehicle.id);
      setDeletingVehicle(null);
      loadVehicles();
    } catch (err) {
      setDeleteError(extractErrorMessage(err, 'Failed to delete vehicle.'));
    } finally {
      setDeleting(false);
    }
  }

  // Filter calculations
  const totalFleet = vehicles?.length ?? 0;
  const availableCount = vehicles?.filter((v) => v.maintenanceStatus === 'Available').length ?? 0;
  const maintenanceCount = vehicles?.filter((v) => v.maintenanceStatus === 'UnderMaintenance').length ?? 0;
  const outOfServiceCount = vehicles?.filter((v) => v.maintenanceStatus === 'OutOfService').length ?? 0;

  const filteredVehicles = vehicles?.filter((v) => {
    if (filterType !== 'all' && v.type !== filterType) return false;
    if (filterStatus !== 'all' && v.maintenanceStatus !== filterStatus) return false;
    if (filterAC === 'ac' && !v.hasAC) return false;
    if (filterAC === 'non-ac' && v.hasAC) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchReg = v.registrationNumber?.toLowerCase().includes(term);
      const matchType = v.type?.toLowerCase().includes(term);
      const matchConfig = v.seatConfiguration?.toLowerCase().includes(term);
      if (!matchReg && !matchType && !matchConfig) return false;
    }
    return true;
  });

  const inputClass =
    'w-full rounded-lg border border-border px-3 py-2 text-sm text-fg focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-surface-raised p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <TruckIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-fg">Vehicle Management</h1>
            <p className="text-sm text-fg-muted">
              Manage transport fleet assets, capacities, maintenance statuses, and registration numbers.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2"
        >
          <PlusCircleIcon className="h-5 w-5" />
          Register Vehicle
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Total Fleet</p>
          <p className="mt-2 text-3xl font-bold text-fg">{totalFleet}</p>
          <p className="mt-1 text-xs text-fg-muted">Vehicles in system</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Available</p>
          <p className="mt-2 text-3xl font-bold text-success">{availableCount}</p>
          <p className="mt-1 text-xs text-fg-muted">Ready for allocation</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Maintenance</p>
          <p className="mt-2 text-3xl font-bold text-warning">{maintenanceCount}</p>
          <p className="mt-1 text-xs text-fg-muted">In garage / servicing</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Out of Service</p>
          <p className="mt-2 text-3xl font-bold text-danger">{outOfServiceCount}</p>
          <p className="mt-1 text-xs text-fg-muted">Inactive or retired</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <input
              type="text"
              placeholder="Search by registration number or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Vehicle Types</option>
              <option value="Van">Van</option>
              <option value="Coach">Coach</option>
              <option value="SUV">SUV</option>
            </select>
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Statuses</option>
              <option value="Available">Available</option>
              <option value="UnderMaintenance">Under Maintenance</option>
              <option value="OutOfService">Out of Service</option>
            </select>
          </div>
          <div>
            <select
              value={filterAC}
              onChange={(e) => setFilterAC(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Climate (AC/Non-AC)</option>
              <option value="ac">Air Conditioned (AC)</option>
              <option value="non-ac">Non-AC</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Vehicle Table/Grid */}
      <div className="rounded-2xl border border-border bg-surface-raised shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-danger">
            <p>{error}</p>
            <button
              type="button"
              onClick={loadVehicles}
              className="mt-3 text-xs font-semibold text-brand-text underline hover:text-brand-text"
            >
              Try Again
            </button>
          </div>
        ) : !filteredVehicles || filteredVehicles.length === 0 ? (
          <div className="p-12 text-center">
            <TruckIcon className="mx-auto h-12 w-12 text-fg-muted" />
            <h3 className="mt-3 text-base font-semibold text-fg">No vehicles found</h3>
            <p className="mt-1 text-sm text-fg-muted">
              {vehicles?.length === 0
                ? 'Get started by adding your first vehicle to the fleet.'
                : 'No vehicles match your active search and filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-fg-muted">
              <thead className="border-b border-border bg-surface-sunken text-xs font-semibold uppercase tracking-wider text-fg-muted">
                <tr>
                  <th scope="col" className="px-6 py-4">Registration</th>
                  <th scope="col" className="px-6 py-4">Type & Capacity</th>
                  <th scope="col" className="px-6 py-4">Climate Control</th>
                  <th scope="col" className="px-6 py-4">Current Status</th>
                  <th scope="col" className="px-6 py-4">Change Status</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredVehicles.map((veh) => (
                  <tr key={veh.id} className="hover:bg-surface-sunken/70 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-fg bg-neutral-soft px-2.5 py-1 rounded-md border border-border">
                          {veh.registrationNumber || 'UNREGISTERED'}
                        </span>
                        <span className="font-mono text-xs text-fg-muted">
                          #{veh.id.slice(0, 8)}
                        </span>
                      </div>
                      {veh.seatConfiguration && (
                        <p className="mt-1 text-xs text-fg-muted">Config: {veh.seatConfiguration}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <VehicleTypeBadge type={veh.type} />
                        <span className="font-semibold text-fg">{veh.capacity} Seats</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {veh.hasAC ? (
                        <span className="inline-flex items-center gap-1 rounded bg-info-soft px-2 py-0.5 text-xs font-medium text-info-fg border border-info/30">
                          ❄️ AC Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-neutral-soft px-2 py-0.5 text-xs font-medium text-fg-muted">
                          Non-AC
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={veh.maintenanceStatus} />
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={veh.maintenanceStatus}
                        disabled={updatingId === veh.id}
                        onChange={(e) =>
                          handleStatusChange(veh.id, e.target.value as VehicleMaintenanceStatus)
                        }
                        className="rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-fg shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                      >
                        <option value="Available">Available</option>
                        <option value="UnderMaintenance">Under Maintenance</option>
                        <option value="OutOfService">Out of Service</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeletingVehicle(veh);
                        }}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger-soft transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Vehicle Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-xl animate-in fade-in zoom-in duration-150">
            <h2 className="font-heading text-lg font-bold text-fg">Register New Vehicle</h2>
            <p className="mt-1 text-xs text-fg-muted">
              Add a van, coach, or SUV to TrailWise's central fleet.
            </p>

            {createError && (
              <div role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-xs font-medium text-danger-fg border border-danger/30">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateVehicle} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-fg mb-1">
                  Registration Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WP CAB-1234 or NW-8921"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">
                    Vehicle Type *
                  </label>
                  <select
                    value={vehType}
                    onChange={(e) => setVehType(e.target.value as VehicleType)}
                    className={inputClass}
                  >
                    <option value="Van">Van</option>
                    <option value="Coach">Coach</option>
                    <option value="SUV">SUV</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-fg mb-1">
                    Passenger Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-fg mb-1">
                  Initial Status
                </label>
                <select
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as VehicleMaintenanceStatus)}
                  className={inputClass}
                >
                  <option value="Available">Available</option>
                  <option value="UnderMaintenance">Under Maintenance</option>
                  <option value="OutOfService">Out of Service</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-fg mb-1">
                  Seat Configuration (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2-2-2-2 or 14 reclining seats"
                  value={seatConfig}
                  onChange={(e) => setSeatConfig(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="hasAC"
                  checked={hasAC}
                  onChange={(e) => setHasAC(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand-text focus:ring-brand-500"
                />
                <label htmlFor="hasAC" className="text-xs font-medium text-fg">
                  Air Conditioned (AC Climate Control)
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={creating}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-fg-muted hover:bg-surface-sunken transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 transition disabled:opacity-50"
                >
                  {creating ? 'Saving...' : 'Register Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Vehicle Modal */}
      {deletingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface-raised p-6 shadow-xl animate-in fade-in zoom-in duration-150">
            <h2 className="font-heading text-lg font-bold text-fg">Delete Vehicle</h2>
            <p className="mt-2 text-xs text-fg-muted">
              Are you sure you want to permanently delete vehicle{' '}
              <span className="font-bold text-fg">
                {deletingVehicle.registrationNumber || deletingVehicle.type}
              </span>
              ? This action cannot be undone.
            </p>

            {deleteError && (
              <div role="alert" className="mt-3 rounded-lg bg-danger-soft p-2.5 text-xs text-danger-fg border border-danger/30">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingVehicle(null)}
                disabled={deleting}
                className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-fg-muted hover:bg-surface-sunken transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteVehicle}
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
