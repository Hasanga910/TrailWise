import { useEffect, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  checkVehicleAvailability,
  createDriver,
  createVehicle,
  deleteVehicle,
  getDrivers,
  getVehicles,
  reserveVehicle,
  updateVehicleMaintenanceStatus,
  type DriverDto,
  type VehicleDto,
  type VehicleMaintenanceStatus,
  type VehicleType,
} from '../../api/vehicles';
import { PlusCircleIcon, TruckIcon } from '../admin/icons';

// Status badge helper styling
export function StatusBadge({ status }: { status: VehicleMaintenanceStatus }) {
  switch (status) {
    case 'Available':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Available
        </span>
      );
    case 'UnderMaintenance':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Under Maintenance
        </span>
      );
    case 'OutOfService':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Out of Service
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {status}
        </span>
      );
  }
}

// Vehicle Type badge helper styling
export function VehicleTypeBadge({ type }: { type: VehicleType }) {
  const styles: Record<VehicleType, string> = {
    Van: 'bg-brand-50 text-brand-700 border-brand-200',
    Coach: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    SUV: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
        styles[type] || 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      {type}
    </span>
  );
}

export function FleetManager() {
  // State for vehicles and drivers
  const [vehicles, setVehicles] = useState<VehicleDto[] | null>(null);
  const [drivers, setDrivers] = useState<DriverDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAC, setFilterAC] = useState<string>('all');
  const [filterMinCap, setFilterMinCap] = useState<string>('');

  // Add Vehicle Form State
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [newType, setNewType] = useState<VehicleType>('Van');
  const [newCapacity, setNewCapacity] = useState<number>(7);
  const [newHasAC, setNewHasAC] = useState<boolean>(true);
  const [newSeatConfig, setNewSeatConfig] = useState<string>('2-2-3');
  const [newStatus, setNewStatus] = useState<VehicleMaintenanceStatus>('Available');
  const [createVehicleError, setCreateVehicleError] = useState<string | null>(null);
  const [creatingVehicle, setCreatingVehicle] = useState(false);

  // Status Change State
  const [updatingVehicleId, setUpdatingVehicleId] = useState<string | null>(null);

  // Check Availability State
  const [checkingVehicle, setCheckingVehicle] = useState<VehicleDto | null>(null);
  const [availFrom, setAvailFrom] = useState('');
  const [availTo, setAvailTo] = useState('');
  const [availResult, setAvailResult] = useState<{
    isAvailable: boolean;
    reason?: string | null;
  } | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  // Reservation / Allocation Form State
  const [reservingVehicle, setReservingVehicle] = useState<VehicleDto | null>(null);
  const [bookingId, setBookingId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [reserveStartDate, setReserveStartDate] = useState('');
  const [reserveEndDate, setReserveEndDate] = useState('');
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reserveSuccess, setReserveSuccess] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);

  // Register Driver State
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [driverContact, setDriverContact] = useState('');
  const [driverError, setDriverError] = useState<string | null>(null);
  const [creatingDriver, setCreatingDriver] = useState(false);

  // Delete Vehicle State
  const [deletingVehicle, setDeletingVehicle] = useState<VehicleDto | null>(null);
  const [deleteVehicleError, setDeleteVehicleError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function loadData() {
    setListError(null);
    Promise.all([
      getVehicles(),
      getDrivers().catch(() => [] as DriverDto[]),
    ])
      .then(([vehiclesRes, driversRes]) => {
        setVehicles(vehiclesRes);
        setDrivers(driversRes);
      })
      .catch((err) => {
        setListError(extractErrorMessage(err, 'Failed to load fleet information.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    loadData();
  }, []);

  // Handle vehicle creation
  async function handleCreateVehicle(e: FormEvent) {
    e.preventDefault();
    setCreateVehicleError(null);
    setCreatingVehicle(true);
    try {
      await createVehicle({
        type: newType,
        capacity: Number(newCapacity),
        hasAC: newHasAC,
        seatConfiguration: newSeatConfig,
        maintenanceStatus: newStatus,
      });
      setShowAddVehicleModal(false);
      // Reset form
      setNewType('Van');
      setNewCapacity(7);
      setNewHasAC(true);
      setNewSeatConfig('2-2-3');
      setNewStatus('Available');
      await loadData();
    } catch (err) {
      setCreateVehicleError(extractErrorMessage(err, 'Could not create vehicle.'));
    } finally {
      setCreatingVehicle(false);
    }
  }

  // Handle Maintenance Status Update
  async function handleStatusChange(id: string, newMaintenanceStatus: VehicleMaintenanceStatus) {
    setUpdatingVehicleId(id);
    try {
      await updateVehicleMaintenanceStatus(id, { status: newMaintenanceStatus });
      setVehicles((prev) =>
        prev
          ? prev.map((v) => (v.id === id ? { ...v, maintenanceStatus: newMaintenanceStatus } : v))
          : null,
      );
    } catch (err) {
      alert(extractErrorMessage(err, 'Could not update maintenance status.'));
    } finally {
      setUpdatingVehicleId(null);
    }
  }

  // Handle Availability Check
  async function handleCheckAvailability(e: FormEvent) {
    e.preventDefault();
    if (!checkingVehicle) return;
    setAvailLoading(true);
    setAvailError(null);
    setAvailResult(null);

    try {
      const res = await checkVehicleAvailability(checkingVehicle.id, availFrom, availTo);
      setAvailResult({ isAvailable: res.isAvailable, reason: res.reason });
    } catch (err) {
      setAvailError(extractErrorMessage(err, 'Failed to verify availability.'));
    } finally {
      setAvailLoading(false);
    }
  }

  // Handle Driver Registration
  async function handleCreateDriver(e: FormEvent) {
    e.preventDefault();
    setDriverError(null);
    setCreatingDriver(true);
    try {
      const created = await createDriver({
        name: driverName.trim(),
        licenseNumber: driverLicense.trim(),
        contactInfo: driverContact.trim(),
      });
      setDrivers((prev) => [...prev, created]);
      setDriverName('');
      setDriverLicense('');
      setDriverContact('');
      setShowDriverModal(false);
    } catch (err) {
      setDriverError(extractErrorMessage(err, 'Could not register driver.'));
    } finally {
      setCreatingDriver(false);
    }
  }

  // Handle Vehicle Reservation
  async function handleReserve(e: FormEvent) {
    e.preventDefault();
    if (!reservingVehicle) return;
    setReserveError(null);
    setReserveSuccess(null);
    setReserving(true);

    try {
      await reserveVehicle(reservingVehicle.id, {
        bookingId: bookingId.trim(),
        driverId: driverId.trim(),
        startDate: reserveStartDate,
        endDate: reserveEndDate,
      });
      setReserveSuccess(
        `Vehicle ${reservingVehicle.type} successfully assigned to booking ${bookingId}!`,
      );
      // Reset form fields
      setBookingId('');
      setDriverId('');
      setReserveStartDate('');
      setReserveEndDate('');
      await loadData();
    } catch (err) {
      setReserveError(extractErrorMessage(err, 'Failed to allocate vehicle reservation.'));
    } finally {
      setReserving(false);
    }
  }

  // Handle Vehicle Deletion
  async function handleDeleteVehicle() {
    if (!deletingVehicle) return;
    setDeleteVehicleError(null);
    setIsDeleting(true);
    try {
      await deleteVehicle(deletingVehicle.id);
      setDeletingVehicle(null);
      await loadData();
    } catch (err) {
      setDeleteVehicleError(extractErrorMessage(err, 'Failed to delete vehicle.'));
    } finally {
      setIsDeleting(false);
    }
  }

  // Filtered vehicles
  const filteredVehicles = vehicles?.filter((v) => {
    if (filterType !== 'all' && v.type !== filterType) return false;
    if (filterStatus !== 'all' && v.maintenanceStatus !== filterStatus) return false;
    if (filterAC !== 'all') {
      const wantsAC = filterAC === 'yes';
      if (v.hasAC !== wantsAC) return false;
    }
    if (filterMinCap) {
      const minCap = parseInt(filterMinCap, 10);
      if (!isNaN(minCap) && v.capacity < minCap) return false;
    }
    return true;
  });

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const labelClass = 'block mb-1 text-xs font-semibold text-slate-600';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <TruckIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-900">Fleet &amp; Transport</h1>
            <p className="text-sm text-slate-500">
              Manage vehicle inventory, maintenance status, availability checks, and transport assignments.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDriverError(null);
              setShowDriverModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <PlusCircleIcon className="h-4 w-4 text-slate-500" />
            Add Driver
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateVehicleError(null);
              setShowAddVehicleModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <PlusCircleIcon className="h-4 w-4" />
            Add Vehicle
          </button>
        </div>
      </div>

      {/* Quick Fleet Metrics */}
      {vehicles && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Fleet</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{vehicles.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Available</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">
              {vehicles.filter((v) => v.maintenanceStatus === 'Available').length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Maintenance</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">
              {vehicles.filter((v) => v.maintenanceStatus === 'UnderMaintenance').length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Out of Service</p>
            <p className="mt-1 text-2xl font-bold text-rose-700">
              {vehicles.filter((v) => v.maintenanceStatus === 'OutOfService').length}
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-36 flex-1">
            <label htmlFor="filter-vehicle-type" className={labelClass}>Vehicle Type</label>
            <select
              id="filter-vehicle-type"
              aria-label="Filter by Vehicle Type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Types</option>
              <option value="Van">Van</option>
              <option value="Coach">Coach</option>
              <option value="SUV">SUV</option>
            </select>
          </div>

          <div className="min-w-36 flex-1">
            <label className={labelClass}>Status</label>
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

          <div className="min-w-32 flex-1">
            <label className={labelClass}>Air Conditioning</label>
            <select
              value={filterAC}
              onChange={(e) => setFilterAC(e.target.value)}
              className={inputClass}
            >
              <option value="all">All</option>
              <option value="yes">AC Required</option>
              <option value="no">Non-AC</option>
            </select>
          </div>

          <div className="min-w-32 flex-1">
            <label className={labelClass}>Min Capacity</label>
            <input
              type="number"
              placeholder="e.g. 6"
              min={1}
              value={filterMinCap}
              onChange={(e) => setFilterMinCap(e.target.value)}
              className={inputClass}
            />
          </div>

          {(filterType !== 'all' ||
            filterStatus !== 'all' ||
            filterAC !== 'all' ||
            filterMinCap !== '') && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setFilterType('all');
                  setFilterStatus('all');
                  setFilterAC('all');
                  setFilterMinCap('');
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error alert */}
      {listError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {listError}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !vehicles && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      )}

      {/* Vehicle Roster Table */}
      {!loading && filteredVehicles && filteredVehicles.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <TruckIcon className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 font-heading text-base font-semibold text-slate-900">
            No vehicles match criteria
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your search filters or click "Add Vehicle" to register a new vehicle.
          </p>
        </div>
      )}

      {!loading && filteredVehicles && filteredVehicles.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3.5 py-3">Vehicle</th>
                  <th className="px-3 py-3">Capacity</th>
                  <th className="px-3 py-3">AC</th>
                  <th className="px-3 py-3">Layout</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="transition hover:bg-slate-50/80">
                    <td className="px-3.5 py-3 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <VehicleTypeBadge type={vehicle.type} />
                        <span className="text-xs text-slate-400 font-mono">
                          #{vehicle.id.substring(0, 8)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                      <span className="font-semibold text-slate-900">{vehicle.capacity}</span> seats
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {vehicle.hasAC ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                          AC
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Non-AC</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                      {vehicle.seatConfiguration || 'Standard'}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={vehicle.maintenanceStatus} />
                        {/* Inline status switcher */}
                        <select
                          disabled={updatingVehicleId === vehicle.id}
                          value={vehicle.maintenanceStatus}
                          onChange={(e) =>
                            handleStatusChange(
                              vehicle.id,
                              e.target.value as VehicleMaintenanceStatus,
                            )
                          }
                          aria-label={`Change status for vehicle ${vehicle.id.substring(0, 8)}`}
                          className="rounded border border-slate-200 bg-white py-0.5 px-1 text-xs text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="Available">Available</option>
                          <option value="UnderMaintenance">Maintenance</option>
                          <option value="OutOfService">Out of Service</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCheckingVehicle(vehicle);
                            setAvailResult(null);
                            setAvailError(null);
                            const today = new Date().toISOString().split('T')[0];
                            setAvailFrom(today);
                            setAvailTo(today);
                          }}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Check Availability
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReservingVehicle(vehicle);
                            setReserveError(null);
                            setReserveSuccess(null);
                            const today = new Date().toISOString().split('T')[0];
                            setReserveStartDate(today);
                            setReserveEndDate(today);
                          }}
                          className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
                        >
                          Allocate
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteVehicleError(null);
                            setDeletingVehicle(vehicle);
                          }}
                          className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700"
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
        </div>
      )}

      {/* MODAL: Add New Vehicle */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="font-heading text-lg font-bold text-slate-900">Add Vehicle to Fleet</h2>
              <button
                type="button"
                onClick={() => setShowAddVehicleModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {createVehicleError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
                {createVehicleError}
              </div>
            )}

            <form onSubmit={handleCreateVehicle} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Vehicle Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as VehicleType)}
                    className={inputClass}
                  >
                    <option value="Van">Van</option>
                    <option value="Coach">Coach</option>
                    <option value="SUV">SUV</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Passenger Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Seat Layout Configuration</label>
                <input
                  type="text"
                  placeholder="e.g. 2-2-3 or 2-2-2-4"
                  value={newSeatConfig}
                  onChange={(e) => setNewSeatConfig(e.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Optional seating rows description for capacity planning.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Initial Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as VehicleMaintenanceStatus)}
                    className={inputClass}
                  >
                    <option value="Available">Available</option>
                    <option value="UnderMaintenance">Under Maintenance</option>
                    <option value="OutOfService">Out of Service</option>
                  </select>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer mt-4">
                    <input
                      type="checkbox"
                      checked={newHasAC}
                      onChange={(e) => setNewHasAC(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Air Conditioned (AC)</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingVehicle}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {creatingVehicle ? 'Saving...' : 'Save Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Check Vehicle Availability */}
      {checkingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-heading text-lg font-bold text-slate-900">
                Check Availability: {checkingVehicle.type}
              </h2>
              <button
                type="button"
                onClick={() => setCheckingVehicle(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Vehicle ID: <span className="font-mono text-slate-700">{checkingVehicle.id}</span>
            </p>

            <form onSubmit={handleCheckAvailability} className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>Start Date (From)</label>
                <input
                  type="date"
                  required
                  value={availFrom}
                  onChange={(e) => setAvailFrom(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>End Date (To)</label>
                <input
                  type="date"
                  required
                  value={availTo}
                  onChange={(e) => setAvailTo(e.target.value)}
                  className={inputClass}
                />
              </div>

              {availError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">
                  {availError}
                </div>
              )}

              {availResult && (
                <div
                  className={`rounded-lg p-3 text-sm font-medium ${
                    availResult.isAvailable
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  {availResult.isAvailable ? (
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Available for the selected date range!</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        <span className="font-bold">Not Available</span>
                      </div>
                      <p className="mt-1 text-xs opacity-90">{availResult.reason}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCheckingVehicle(null)}
                  className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={availLoading}
                  className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {availLoading ? 'Checking...' : 'Run Query'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reserve / Allocate Vehicle */}
      {reservingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-heading text-lg font-bold text-slate-900">
                Allocate {reservingVehicle.type} ({reservingVehicle.capacity} seats)
              </h2>
              <button
                type="button"
                onClick={() => setReservingVehicle(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {reserveError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">
                {reserveError}
              </div>
            )}

            {reserveSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
                {reserveSuccess}
              </div>
            )}

            <form onSubmit={handleReserve} className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>Booking ID (GUID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Assigned Driver</label>
                {drivers.length > 0 ? (
                  <select
                    required
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select a driver...</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.licenseNumber})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Enter Driver ID (GUID)"
                      value={driverId}
                      onChange={(e) => setDriverId(e.target.value)}
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-amber-600">
                      No drivers registered in list. You can enter a Driver GUID directly or register
                      one with "Add Driver".
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Start Date</label>
                  <input
                    type="date"
                    required
                    value={reserveStartDate}
                    onChange={(e) => setReserveStartDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>End Date</label>
                  <input
                    type="date"
                    required
                    value={reserveEndDate}
                    onChange={(e) => setReserveEndDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setReservingVehicle(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Done
                </button>
                <button
                  type="submit"
                  disabled={reserving}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {reserving ? 'Assigning...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Driver */}
      {showDriverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-heading text-lg font-bold text-slate-900">Register Driver</h2>
              <button
                type="button"
                onClick={() => setShowDriverModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {driverError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">
                {driverError}
              </div>
            )}

            <form onSubmit={handleCreateDriver} className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Driver License Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. B-98765432"
                  value={driverLicense}
                  onChange={(e) => setDriverLicense(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Contact Info</label>
                <input
                  type="text"
                  placeholder="Phone number or email"
                  value={driverContact}
                  onChange={(e) => setDriverContact(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDriverModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDriver}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {creatingDriver ? 'Registering...' : 'Register Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Vehicle Confirmation */}
      {deletingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-heading text-lg font-bold text-slate-900">
              Delete Vehicle #{deletingVehicle.id.substring(0, 8)}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to remove this <strong>{deletingVehicle.type}</strong> ({deletingVehicle.capacity} seats) from the fleet? Any dependent reservations and assignments will be deleted. This cannot be undone.
            </p>

            {deleteVehicleError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">
                {deleteVehicleError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingVehicle(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteVehicle}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
