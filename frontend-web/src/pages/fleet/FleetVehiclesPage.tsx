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
import { StatusBadge, VehicleTypeBadge } from '../../components/fleet/fleetBadges';
import { Badge, Button, Card, Checkbox, EmptyState, Input, Modal, PageHeader, Select, Skeleton } from '../../components/ui';
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

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand-text">
            <TruckIcon className="h-6 w-6" />
          </div>
          <PageHeader
            as="h1"
            title="Vehicle Management"
            description="Manage transport fleet assets, capacities, maintenance statuses, and registration numbers."
            className="mb-0"
          />
        </div>
        <Button
          leftIcon={<PlusCircleIcon className="h-5 w-5" />}
          onClick={() => {
            setCreateError(null);
            setShowModal(true);
          }}
        >
          Register Vehicle
        </Button>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Fleet', value: totalFleet, hint: 'Vehicles in system', color: 'text-fg' },
          { label: 'Available', value: availableCount, hint: 'Ready for allocation', color: 'text-success-fg' },
          { label: 'Maintenance', value: maintenanceCount, hint: 'In garage / servicing', color: 'text-warning-fg' },
          { label: 'Out of Service', value: outOfServiceCount, hint: 'Inactive or retired', color: 'text-danger-fg' },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-overline text-fg-muted">{stat.label}</p>
            <p className={`mt-2 font-heading text-h1 ${stat.color}`}>{stat.value}</p>
            <p className="mt-1 text-caption text-fg-muted">{stat.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            wrapperClassName="lg:col-span-2"
            type="text"
            aria-label="Search vehicles"
            placeholder="Search by registration number or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select aria-label="Filter by vehicle type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Vehicle Types</option>
            <option value="Van">Van</option>
            <option value="Coach">Coach</option>
            <option value="SUV">SUV</option>
          </Select>
          <Select aria-label="Filter by status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="Available">Available</option>
            <option value="UnderMaintenance">Under Maintenance</option>
            <option value="OutOfService">Out of Service</option>
          </Select>
          <Select aria-label="Filter by climate control" value={filterAC} onChange={(e) => setFilterAC(e.target.value)}>
            <option value="all">All Climate (AC/Non-AC)</option>
            <option value="ac">Air Conditioned (AC)</option>
            <option value="non-ac">Non-AC</option>
          </Select>
        </div>
      </Card>

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6" role="status" aria-label="Loading vehicles">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-body text-danger-fg">
            <p>{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={loadVehicles}>
              Try Again
            </Button>
          </div>
        ) : !filteredVehicles || filteredVehicles.length === 0 ? (
          <EmptyState
            icon={<TruckIcon className="h-8 w-8" />}
            title="No vehicles found"
            description={
              vehicles?.length === 0
                ? 'Get started by adding your first vehicle to the fleet.'
                : 'No vehicles match your active search and filter criteria.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body text-fg-muted">
              <thead className="border-b border-border bg-surface-sunken text-caption font-semibold uppercase tracking-wider text-fg-muted">
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
                  <tr key={veh.id} className="transition hover:bg-surface-sunken/70">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-border bg-neutral-soft px-2.5 py-1 font-mono text-caption font-bold text-fg">
                          {veh.registrationNumber || 'UNREGISTERED'}
                        </span>
                        <span className="font-mono text-caption text-fg-muted">#{veh.id.slice(0, 8)}</span>
                      </div>
                      {veh.seatConfiguration && (
                        <p className="mt-1 text-caption text-fg-muted">Config: {veh.seatConfiguration}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <VehicleTypeBadge type={veh.type} />
                        <span className="font-semibold text-fg">{veh.capacity} Seats</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {veh.hasAC ? <Badge tone="info">❄️ AC Enabled</Badge> : <Badge>Non-AC</Badge>}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={veh.maintenanceStatus} />
                    </td>
                    <td className="px-6 py-4">
                      <Select
                        aria-label={`Change status for ${veh.registrationNumber || veh.type}`}
                        value={veh.maintenanceStatus}
                        disabled={updatingId === veh.id}
                        onChange={(e) => handleStatusChange(veh.id, e.target.value as VehicleMaintenanceStatus)}
                      >
                        <option value="Available">Available</option>
                        <option value="UnderMaintenance">Under Maintenance</option>
                        <option value="OutOfService">Out of Service</option>
                      </Select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger-fg hover:bg-danger-soft hover:text-danger-fg"
                        onClick={() => {
                          setDeleteError(null);
                          setDeletingVehicle(veh);
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={() => {
          if (!creating) setShowModal(false);
        }}
        size="sm"
        title="Register New Vehicle"
        description="Add a van, coach, or SUV to TrailWise's central fleet."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" form="register-vehicle-form" disabled={creating}>
              {creating ? 'Saving...' : 'Register Vehicle'}
            </Button>
          </>
        }
      >
        {createError && (
          <div role="alert" className="mb-4 rounded-input border border-danger/30 bg-danger-soft p-3 text-caption font-medium text-danger-fg">
            {createError}
          </div>
        )}

        <form id="register-vehicle-form" onSubmit={handleCreateVehicle} className="space-y-4">
          <Input
            label="Registration Number *"
            type="text"
            required
            placeholder="e.g. WP CAB-1234 or NW-8921"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Vehicle Type *" value={vehType} onChange={(e) => setVehType(e.target.value as VehicleType)}>
              <option value="Van">Van</option>
              <option value="Coach">Coach</option>
              <option value="SUV">SUV</option>
            </Select>
            <Input
              label="Passenger Capacity *"
              type="number"
              min="1"
              max="100"
              required
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>

          <Select
            label="Initial Status"
            value={initialStatus}
            onChange={(e) => setInitialStatus(e.target.value as VehicleMaintenanceStatus)}
          >
            <option value="Available">Available</option>
            <option value="UnderMaintenance">Under Maintenance</option>
            <option value="OutOfService">Out of Service</option>
          </Select>

          <Input
            label="Seat Configuration (Optional)"
            type="text"
            placeholder="e.g. 2-2-2-2 or 14 reclining seats"
            value={seatConfig}
            onChange={(e) => setSeatConfig(e.target.value)}
          />

          <Checkbox
            id="hasAC"
            label="Air Conditioned (AC Climate Control)"
            checked={hasAC}
            onChange={(e) => setHasAC(e.target.checked)}
          />
        </form>
      </Modal>

      <Modal
        open={deletingVehicle !== null}
        onClose={() => {
          if (!deleting) setDeletingVehicle(null);
        }}
        size="sm"
        title="Delete Vehicle"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingVehicle(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteVehicle} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </>
        }
      >
        {deletingVehicle && (
          <p className="text-body text-fg-muted">
            Are you sure you want to permanently delete vehicle{' '}
            <span className="font-bold text-fg">{deletingVehicle.registrationNumber || deletingVehicle.type}</span>? This
            action cannot be undone.
          </p>
        )}
        {deleteError && (
          <div role="alert" className="mt-3 rounded-input border border-danger/30 bg-danger-soft p-2.5 text-caption text-danger-fg">
            {deleteError}
          </div>
        )}
      </Modal>
    </div>
  );
}
