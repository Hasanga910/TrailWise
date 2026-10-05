import { useEffect, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  checkDriverAvailability,
  checkVehicleAvailability,
  getDrivers,
  getVehicles,
  getVehicleAssignments,
  reserveVehicle,
  type DriverDto,
  type VehicleAssignmentDetailDto,
  type VehicleDto,
  type VehicleMaintenanceStatus,
  type VehicleType,
} from '../../api/vehicles';
import {
  decideBooking,
  getPagedBookings,
  getAvailableGuidesForBooking,
  type BookingDto,
  type AvailableGuideDto,
} from '../../api/bookings';
import { getAgentWorkflow, type AgentWorkflowDto } from '../../api/agentWorkflows';
import { getGuides, type GuideDto } from '../../api/guides';
import { BookingsIcon, TruckIcon } from '../admin/icons';
import { Link } from 'react-router-dom';
import { notify } from '../ui/notify';

// Exported badge helpers
export function StatusBadge({ status }: { status: VehicleMaintenanceStatus }) {
  switch (status) {
    case 'Available':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-fg ring-1 ring-inset ring-success/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Available
        </span>
      );
    case 'UnderMaintenance':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-fg ring-1 ring-inset ring-warning/20">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Under Maintenance
        </span>
      );
    case 'OutOfService':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger-fg ring-1 ring-inset ring-danger/20">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Out of Service
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-medium text-fg-muted">
          {status}
        </span>
      );
  }
}

export function VehicleTypeBadge({ type }: { type: VehicleType }) {
  const styles: Record<VehicleType, string> = {
    Van: 'bg-brand-soft text-brand-text border-brand-500/30',
    Coach: 'bg-info-soft text-info-fg border-info/30',
    SUV: 'bg-warning-soft text-warning-fg border-warning/30',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
        styles[type] || 'bg-neutral-soft text-fg border-border'
      }`}
    >
      {type}
    </span>
  );
}

export function BookingStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'NeedsManualReview':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger-fg border border-danger/30 animate-pulse">
          Needs Review
        </span>
      );
    case 'PlanProposed':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-info-soft px-2 py-0.5 text-xs font-bold text-info-fg border border-info/30">
          ✨ Plan Proposed
        </span>
      );
    case 'PendingApproval':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning-fg border border-warning/30">
          Pending Approval
        </span>
      );
    case 'Requested':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-info-soft px-2 py-0.5 text-xs font-bold text-info-fg border border-info/30">
          Requested
        </span>
      );
    case 'Confirmed':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-success-soft px-2 py-0.5 text-xs font-bold text-success-fg border border-success/30">
          Confirmed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded bg-neutral-soft px-2 py-0.5 text-xs font-medium text-fg-muted">
          {status}
        </span>
      );
  }
}

export function FleetManager() {
  const [vehicles, setVehicles] = useState<VehicleDto[] | null>(null);
  const [drivers, setDrivers] = useState<DriverDto[]>([]);
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active queue tab filter: NeedsManualReview (main priority), PlanProposed, PendingApproval, Requested, All
  const [queueTab, setQueueTab] = useState<'NeedsManualReview' | 'PlanProposed' | 'PendingApproval' | 'Requested' | 'All'>('NeedsManualReview');

  // Currently selected booking for smart allocation or review
  const [selectedBooking, setSelectedBooking] = useState<BookingDto | null>(null);

  // Smart vehicle availability cache for the selected booking's date window: vehicleId -> { isAvailable: boolean, reason?: string }
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, { isAvailable: boolean; reason?: string | null }>>({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Smart driver availability cache for the selected booking's date window: driverId -> { isAvailable: boolean, reason?: string }
  const [driverAvailabilityMap, setDriverAvailabilityMap] = useState<Record<string, { isAvailable: boolean; reason?: string | null }>>({});
  const [checkingDriverAvailability, setCheckingDriverAvailability] = useState(false);

  // Filters for Smart Vehicle Match list
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('all');
  const [minSeatsFilter, setMinSeatsFilter] = useState<string>('');
  const [onlyAvailableVehicles, setOnlyAvailableVehicles] = useState<boolean>(false);

  // Agent proposed plan inspection for PlanProposed bookings
  const [workflowPlan, setWorkflowPlan] = useState<AgentWorkflowDto | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  // Active vehicle assignments map: bookingId -> VehicleAssignmentDetailDto
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, VehicleAssignmentDetailDto>>({});
  const [currentAssignment, setCurrentAssignment] = useState<VehicleAssignmentDetailDto | null>(null);

  // Allocation modal state
  const [allocatingVehicle, setAllocatingVehicle] = useState<VehicleDto | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedGuideId, setSelectedGuideId] = useState('');
  const [availableGuides, setAvailableGuides] = useState<AvailableGuideDto[]>([]);
  const [allGuides, setAllGuides] = useState<GuideDto[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [allocating, setAllocating] = useState(false);

  // Plan approval state
  const [approving, setApproving] = useState(false);

  function loadData() {
    setError(null);
    Promise.all([
      getVehicles(),
      getDrivers().catch(() => [] as DriverDto[]),
      getGuides().catch(() => [] as GuideDto[]),
      getPagedBookings({ pageSize: 50 }).catch(() => ({ items: [] as BookingDto[], totalCount: 0, page: 1, pageSize: 50 })),
      getVehicleAssignments().catch(() => [] as VehicleAssignmentDetailDto[]),
    ])
      .then(([vehRes, driverRes, guideRes, bookRes, assignRes]) => {
        setVehicles(vehRes);
        setDrivers(driverRes);
        setAllGuides(guideRes);
        const bItems = bookRes.items || [];
        setBookings(bItems);

        const aMap: Record<string, VehicleAssignmentDetailDto> = {};
        assignRes.forEach((a: VehicleAssignmentDetailDto) => {
          if (a.bookingId) aMap[a.bookingId] = a;
        });
        setAssignmentsMap(aMap);

        // Keep or auto-select first priority booking if none selected
        if (!selectedBooking && bItems.length > 0) {
          const priority = bItems.find((b: BookingDto) => b.status === 'NeedsManualReview') ||
            bItems.find((b: BookingDto) => b.status === 'PlanProposed') ||
            bItems.find((b: BookingDto) => b.status === 'PendingApproval') ||
            bItems.find((b: BookingDto) => b.status === 'Requested') ||
            bItems[0];
          setSelectedBooking(priority);
        } else if (selectedBooking) {
          const updated = bItems.find((b: BookingDto) => b.id === selectedBooking.id);
          if (updated) setSelectedBooking(updated);
        }
      })
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load fleet and booking data.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  // When selectedBooking changes, perform smart date-window availability checks against all vehicles
  useEffect(() => {
    if (!selectedBooking || !vehicles || vehicles.length === 0) {
      setAvailabilityMap({});
      return;
    }

    let isMounted = true;
    setCheckingAvailability(true);

    const promises = vehicles.map(async (veh) => {
      try {
        const res = await checkVehicleAvailability(veh.id, selectedBooking.startDate, selectedBooking.endDate);
        return { id: veh.id, isAvailable: res.isAvailable, reason: res.reason };
      } catch {
        return { id: veh.id, isAvailable: false, reason: 'Availability check error' };
      }
    });

    Promise.all(promises).then((results) => {
      if (!isMounted) return;
      const map: Record<string, { isAvailable: boolean; reason?: string | null }> = {};
      results.forEach((r) => {
        map[r.id] = { isAvailable: r.isAvailable, reason: r.reason };
      });
      setAvailabilityMap(map);
      setCheckingAvailability(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedBooking, vehicles]);

  // When selectedBooking changes, perform smart date-window availability checks against all drivers
  useEffect(() => {
    if (!selectedBooking || !drivers || drivers.length === 0) {
      setDriverAvailabilityMap({});
      return;
    }

    let isMounted = true;
    setCheckingDriverAvailability(true);

    const promises = drivers.map(async (drv) => {
      try {
        const res = await checkDriverAvailability(drv.id, selectedBooking.startDate, selectedBooking.endDate);
        return { id: drv.id, isAvailable: res.isAvailable, reason: res.reason };
      } catch {
        return { id: drv.id, isAvailable: false, reason: 'Availability check error' };
      }
    });

    Promise.all(promises).then((results) => {
      if (!isMounted) return;
      const map: Record<string, { isAvailable: boolean; reason?: string | null }> = {};
      results.forEach((r) => {
        map[r.id] = { isAvailable: r.isAvailable, reason: r.reason };
      });
      setDriverAvailabilityMap(map);
      setCheckingDriverAvailability(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedBooking, drivers]);

  // When selectedBooking or assignmentsMap changes, look up existing vehicle assignment from cache
  useEffect(() => {
    if (!selectedBooking) {
      setCurrentAssignment(null);
      return;
    }

    setCurrentAssignment(assignmentsMap[selectedBooking.id] ?? null);
  }, [selectedBooking, assignmentsMap]);

  // When selectedBooking changes, fetch available tour guides with overlap check
  useEffect(() => {
    if (!selectedBooking) {
      setAvailableGuides([]);
      return;
    }

    setLoadingGuides(true);
    getAvailableGuidesForBooking(selectedBooking.id)
      .then((guides) => setAvailableGuides(guides))
      .catch(() => setAvailableGuides([]))
      .finally(() => setLoadingGuides(false));
  }, [selectedBooking]);

  // When selectedBooking is in PlanProposed status, load its agent workflow details
  useEffect(() => {
    if (!selectedBooking || selectedBooking.status !== 'PlanProposed') {
      setWorkflowPlan(null);
      return;
    }

    setWorkflowLoading(true);
    getAgentWorkflow(selectedBooking.id)
      .then((data) => setWorkflowPlan(data))
      .catch(() => setWorkflowPlan(null))
      .finally(() => setWorkflowLoading(false));
  }, [selectedBooking]);

  // Approve & Confirm PlanProposed booking
  async function handleApprovePlan() {
    if (!selectedBooking) return;
    setApproving(true);
    try {
      await decideBooking(selectedBooking.id, { decision: 'Approve' });
      loadData();
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Failed to approve plan.'));
    } finally {
      setApproving(false);
    }
  }

  // Handle manual vehicle allocation
  async function handleConfirmAllocation(e: FormEvent) {
    e.preventDefault();
    if (!selectedBooking || !allocatingVehicle || !selectedDriverId) return;

    // Capacity validation check
    if (selectedBooking.groupSize > allocatingVehicle.capacity) {
      notify.error(`Group size (${selectedBooking.groupSize}) exceeds vehicle capacity (${allocatingVehicle.capacity}). Assignment blocked.`);
      return;
    }

    setAllocating(true);

    try {
      await reserveVehicle(allocatingVehicle.id, {
        bookingId: selectedBooking.id,
        driverId: selectedDriverId,
        startDate: selectedBooking.startDate,
        endDate: selectedBooking.endDate,
        guideId: selectedGuideId ? selectedGuideId : undefined,
      });

      notify.success(`Successfully allocated ${allocatingVehicle.type}, driver, and tour guide to booking!`);
      setTimeout(() => {
        setAllocatingVehicle(null);
        setSelectedDriverId('');
        setSelectedGuideId('');
        loadData();
      }, 1200);
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Failed to allocate resources.'));
    } finally {
      setAllocating(false);
    }
  }

  // Filter bookings for queue
  const queueBookings = bookings.filter((b) => {
    if (queueTab === 'All') return true;
    return b.status === queueTab;
  });

  // Operational metrics
  const needsReviewCount = bookings.filter((b) => b.status === 'NeedsManualReview').length;
  const planProposedCount = bookings.filter((b) => b.status === 'PlanProposed').length;
  const pendingApprovalCount = bookings.filter((b) => b.status === 'PendingApproval').length;
  const requestedCount = bookings.filter((b) => b.status === 'Requested').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-surface-raised p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <TruckIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-fg">
              Fleet &amp; Transport Workspace
            </h1>
            <p className="text-sm text-fg-muted">
              Operational dispatch, conflict-free smart vehicle allocation, and agent proposal approval.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/fleet/vehicles"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3.5 py-2 text-xs font-semibold text-fg shadow-sm hover:bg-surface-sunken transition"
          >
            <TruckIcon className="h-4 w-4 text-fg-muted" />
            Manage Vehicles
          </Link>
          <Link
            to="/fleet/assignments"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 transition"
          >
            View All Schedules
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm font-medium text-danger-fg shadow-sm">
          {error}
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Operational Allocation Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-border bg-surface-raised p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookingsIcon className="h-5 w-5 text-brand-text" />
                <h2 className="font-heading text-base font-bold text-fg">Allocation Queue</h2>
              </div>
              <span className="text-xs font-semibold text-fg-muted">{bookings.length} Bookings</span>
            </div>

            {/* Queue Filter Tabs */}
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-neutral-soft p-1 text-xs font-medium sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setQueueTab('NeedsManualReview')}
                className={`flex flex-col items-center rounded-lg py-1.5 px-1 transition ${
                  queueTab === 'NeedsManualReview'
                    ? 'bg-rose-600 text-white font-bold shadow-xs'
                    : 'text-fg-muted hover:text-fg hover:bg-white/50'
                }`}
              >
                <span>Needs Review</span>
                <span className="text-[10px] font-bold">({needsReviewCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('PlanProposed')}
                className={`flex flex-col items-center rounded-lg py-1.5 px-1 transition ${
                  queueTab === 'PlanProposed'
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : 'text-fg-muted hover:text-fg hover:bg-white/50'
                }`}
              >
                <span>Proposed</span>
                <span className="text-[10px] font-bold">({planProposedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('PendingApproval')}
                className={`flex flex-col items-center rounded-lg py-1.5 px-1 transition ${
                  queueTab === 'PendingApproval'
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'text-fg-muted hover:text-fg hover:bg-white/50'
                }`}
              >
                <span>Pending</span>
                <span className="text-[10px] font-bold">({pendingApprovalCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('Requested')}
                className={`flex flex-col items-center rounded-lg py-1.5 px-1 transition ${
                  queueTab === 'Requested'
                    ? 'bg-brand-700 text-white font-bold shadow-xs'
                    : 'text-fg-muted hover:text-fg hover:bg-white/50'
                }`}
              >
                <span>Requested</span>
                <span className="text-[10px] font-bold">({requestedCount})</span>
              </button>
            </div>

            {/* Bookings List */}
            {loading ? (
              <div className="py-12 text-center text-xs text-fg-muted">Loading queue...</div>
            ) : queueBookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-xs font-semibold text-fg-muted">No bookings in this state</p>
                <p className="mt-1 text-[11px] text-fg-muted">
                  {queueTab === 'NeedsManualReview'
                    ? 'Awesome! No failed AI allocations require intervention.'
                    : `No bookings currently tagged as ${queueTab}.`}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {queueBookings.map((b) => {
                  const isSelected = selectedBooking?.id === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition text-left ${
                        isSelected
                          ? 'border-brand-500 bg-brand-soft/40 ring-1 ring-brand-500 shadow-xs'
                          : 'border-border bg-surface-raised hover:border-border hover:bg-surface-sunken/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-heading text-xs font-bold text-fg">
                            {b.tourPackageName || 'Custom Sri Lanka Tour'}
                          </p>
                          <p className="text-[11px] text-fg-muted">
                            {b.startDate} to {b.endDate}
                          </p>
                        </div>
                        <BookingStatusBadge status={b.status} />
                      </div>

                      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2 text-[11px] text-fg-muted">
                        <span className="font-semibold text-fg">
                          👥 {b.groupSize} Guests
                        </span>
                        {b.packageTier?.requiresAC && (
                          <span className="text-info-fg bg-info-soft px-1.5 py-0.5 rounded border border-info/30 font-medium">
                            ❄️ AC Required
                          </span>
                        )}
                        <span className="font-mono text-fg-muted text-[10px]">
                          REF: {b.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Booking Workspace & Smart Vehicle Availability (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {!selectedBooking ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface-raised p-12 text-center">
              <TruckIcon className="mx-auto h-12 w-12 text-fg-muted" />
              <h3 className="mt-3 text-sm font-semibold text-fg">No Booking Selected</h3>
              <p className="mt-1 text-xs text-fg-muted">
                Select a booking from the allocation queue on the left to verify vehicle dates and assign transport.
              </p>
            </div>
          ) : (
            <>
              {/* Selected Booking Header & Inspection Card */}
              <div className="rounded-2xl border border-border bg-surface-raised p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-base font-bold text-fg">
                        {selectedBooking.tourPackageName}
                      </h2>
                      <BookingStatusBadge status={selectedBooking.status} />
                    </div>
                    <p className="text-xs text-fg-muted mt-0.5">
                      Booking ID: <span className="font-mono text-fg">{selectedBooking.id}</span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-surface-sunken border border-border px-3 py-1.5 text-xs text-right">
                    <span className="text-fg-muted block text-[10px] uppercase font-semibold">Service Window</span>
                    <span className="font-bold text-fg">
                      {selectedBooking.startDate} &rarr; {selectedBooking.endDate}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-surface-sunken p-2.5">
                    <span className="text-fg-muted block text-[10px]">Group Size</span>
                    <span className="font-bold text-fg text-sm">{selectedBooking.groupSize} Guests</span>
                  </div>
                  <div className="rounded-lg bg-surface-sunken p-2.5">
                    <span className="text-fg-muted block text-[10px]">Climate Req.</span>
                    <span className={`font-bold text-sm ${selectedBooking.packageTier?.requiresAC ? 'text-info-fg' : 'text-fg'}`}>
                      {selectedBooking.packageTier?.requiresAC ? '❄️ AC Required' : 'Standard'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-surface-sunken p-2.5">
                    <span className="text-fg-muted block text-[10px]">Tier Class</span>
                    <span className="font-bold text-fg text-sm">
                      {selectedBooking.packageTier?.classType || 'Standard'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-surface-sunken p-2.5">
                    <span className="text-fg-muted block text-[10px]">Budget</span>
                    <span className="font-bold text-fg text-sm">
                      ${selectedBooking.budgetPerPerson}/pax
                    </span>
                  </div>
                </div>

                {selectedBooking.specialRequests && (
                  <div className="rounded-xl border border-warning/30 bg-warning-soft/60 p-3 text-xs text-warning-fg">
                    <span className="font-bold">Special Requests: </span>
                    {selectedBooking.specialRequests}
                  </div>
                )}

                {/* Assigned Vehicle & Driver Display Card */}
                {currentAssignment && (
                  <div className="rounded-xl border border-success/30 bg-success-soft/70 p-4 text-xs text-success-fg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold">
                        🚐
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-success-fg text-sm">{currentAssignment.vehicleName}</span>
                          {currentAssignment.registrationNumber && (
                            <span className="font-mono text-[11px] bg-surface-raised border border-success/30 text-success-fg px-1.5 py-0.5 rounded font-bold">
                              {currentAssignment.registrationNumber}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold uppercase bg-success-soft/80 text-success-fg px-2 py-0.5 rounded-full">
                            Vehicle Assigned
                          </span>
                        </div>
                        <p className="text-success-fg text-xs mt-0.5">
                          Assigned Driver: <span className="font-semibold text-success-fg">{currentAssignment.driverName}</span> {currentAssignment.driverContact ? `(${currentAssignment.driverContact})` : ''}
                        </p>
                        {currentAssignment.guideName && (
                          <p className="text-info-fg text-xs mt-0.5">
                            Assigned Guide: <span className="font-semibold text-info-fg">{currentAssignment.guideName}</span> {currentAssignment.guideContact ? `(${currentAssignment.guideContact})` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-success-fg font-medium bg-white/80 px-2.5 py-1 rounded-lg border border-success/30 self-start sm:self-auto">
                      Confirmed Dispatch
                    </span>
                  </div>
                )}
              </div>

              {/* Agent Plan Review Card (For PlanProposed state) */}
              {selectedBooking.status === 'PlanProposed' && (() => {
                // Extract step outputs from agent logs
                const guideStep = workflowPlan?.steps?.find((s) => s.agentName === 'GuideMatchingAgent');
                const fleetStep = workflowPlan?.steps?.find((s) => s.agentName === 'FleetCapacityAgent');
                const pricingStep = workflowPlan?.steps?.find((s) => s.agentName === 'PricingValidationAgent' && s.output && typeof s.output === 'object' && 'totalCost' in s.output);

                const guideOutput = guideStep?.output as { guideId?: string; matchScore?: number; reasoning?: string } | undefined;
                const fleetOutput = fleetStep?.output as { vehicleId?: string; driverId?: string; acMatch?: boolean; seatConfigMatch?: boolean; conflictCheck?: boolean } | undefined;
                const pricingOutput = pricingStep?.output as { totalCost?: number } | undefined;

                const matchedGuide = allGuides.find((g) => g.id === guideOutput?.guideId);
                const matchedVehicle = vehicles?.find((v) => v.id === fleetOutput?.vehicleId);
                const matchedDriver = drivers.find((d) => d.id === fleetOutput?.driverId);

                return (
                  <div className="rounded-2xl border-2 border-info/30 bg-gradient-to-br from-info-soft/70 via-surface-raised to-info-soft/40 p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-info/30 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white font-bold text-sm shadow-xs">
                          AI
                        </span>
                        <div>
                          <h3 className="font-heading text-sm font-bold text-info-fg">
                            Agent Plan Review &amp; Resource Matching
                          </h3>
                          <p className="text-xs text-info-fg">
                            The multi-agent coordinator formulated this complete resource package (Vehicle + Driver + Guide).
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-info-soft px-3 py-1 text-xs font-bold text-info-fg border border-info/30">
                        ✨ Plan Proposed
                      </span>
                    </div>

                    {workflowLoading ? (
                      <div className="py-8 text-center text-xs text-info animate-pulse">Loading agent recommendation...</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left: Traveler & Trip Details */}
                        <div className="rounded-xl border border-info/30 bg-surface-raised p-4 text-xs space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between border-b border-border pb-2">
                            <p className="font-semibold uppercase tracking-wider text-[10px] text-info">
                              Traveler &amp; Requirements
                            </p>
                            <span className="font-mono text-[10px] text-fg-muted">
                              REF: {selectedBooking.id.slice(0, 8)}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-fg">
                            <p><span className="text-fg-muted">Package:</span> <span className="font-bold text-fg">{selectedBooking.tourPackageName}</span></p>
                            <p><span className="text-fg-muted">Trip Dates:</span> <span className="font-semibold text-fg">{selectedBooking.startDate} &rarr; {selectedBooking.endDate}</span></p>
                            <p><span className="text-fg-muted">Party Size:</span> <span className="font-bold text-fg">👥 {selectedBooking.groupSize} Guests</span></p>
                            <p><span className="text-fg-muted">Climate:</span> <span className="font-semibold text-fg">{selectedBooking.packageTier?.requiresAC ? '❄️ AC Mandatory' : 'Standard Air'}</span></p>
                            {selectedBooking.languagePreference && (
                              <p><span className="text-fg-muted">Language:</span> <span className="font-semibold text-info-fg">🗣️ {selectedBooking.languagePreference}</span></p>
                            )}
                            {selectedBooking.specialRequests && (
                              <div className="mt-2 rounded-lg bg-warning-soft/80 p-2.5 text-warning-fg border border-warning/30 text-[11px] italic">
                                "{selectedBooking.specialRequests}"
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Agent Resource Recommendation & Validation Chips */}
                        <div className="rounded-xl border border-info/30 bg-surface-raised p-4 text-xs space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between border-b border-border pb-2">
                            <p className="font-semibold uppercase tracking-wider text-[10px] text-info">
                              Agent Recommended Allocation
                            </p>
                            <span className="font-semibold text-success-fg bg-success-soft px-2 py-0.5 rounded border border-success/30 text-[10px]">
                              3/3 Allocated
                            </span>
                          </div>

                          {/* Vehicle Match */}
                          <div className="rounded-lg bg-surface-sunken p-2.5 border border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🚐</span>
                              <div>
                                <p className="font-bold text-fg text-xs">
                                  {matchedVehicle ? `${matchedVehicle.type} (${matchedVehicle.capacity} seats)` : 'AI-Optimized Vehicle'}
                                </p>
                                <p className="text-[10px] text-fg-muted font-mono">
                                  {matchedVehicle?.registrationNumber || 'Matched by FleetCapacityAgent'}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-success-fg bg-success-soft/70 px-2 py-0.5 rounded">
                              Fit OK
                            </span>
                          </div>

                          {/* Driver Match */}
                          <div className="rounded-lg bg-surface-sunken p-2.5 border border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🧑‍✈️</span>
                              <div>
                                <p className="font-bold text-fg text-xs">
                                  {matchedDriver ? matchedDriver.name : 'AI-Verified Driver'}
                                </p>
                                <p className="text-[10px] text-fg-muted">
                                  {matchedDriver?.contactInfo || 'Conflict-free schedule'}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-success-fg bg-success-soft/70 px-2 py-0.5 rounded">
                              Conflict-Free
                            </span>
                          </div>

                          {/* Tour Guide Match */}
                          <div className="rounded-lg bg-info-soft/70 p-2.5 border border-info/30 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🧭</span>
                              <div>
                                <p className="font-bold text-info-fg text-xs">
                                  {matchedGuide ? matchedGuide.name : 'AI-Matched Tour Guide'}
                                </p>
                                <p className="text-[10px] text-info-fg">
                                  {guideOutput?.reasoning ? guideOutput.reasoning : (matchedGuide?.specializations?.join(', ') || 'Specialized guide matched')}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-info-fg bg-info-soft/80 px-2 py-0.5 rounded">
                              {guideOutput?.matchScore ? `${Math.round(guideOutput.matchScore * 100)}% Match` : 'Verified'}
                            </span>
                          </div>

                          {/* Validation Chips */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="inline-flex items-center gap-1 rounded bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-fg border border-success/30">
                              ✓ No Date Conflicts
                            </span>
                            <span className="inline-flex items-center gap-1 rounded bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-fg border border-success/30">
                              ✓ Capacity OK: {selectedBooking.groupSize} Guests
                            </span>
                            {selectedBooking.packageTier?.requiresAC && (
                              <span className="inline-flex items-center gap-1 rounded bg-info-soft px-2 py-0.5 text-[11px] font-semibold text-info-fg border border-info/30">
                                ✓ Climate AC Verified
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded bg-info-soft px-2 py-0.5 text-[11px] font-semibold text-info-fg border border-info/30">
                              ✓ Guide Matched
                            </span>
                            <span className="inline-flex items-center gap-1 rounded bg-info-soft px-2 py-0.5 text-[11px] font-semibold text-info-fg border border-info/30">
                              ✓ Budget Feasible {pricingOutput?.totalCost ? `($${pricingOutput.totalCost})` : ''}
                            </span>
                          </div>

                          {workflowPlan?.summaryText && (
                            <p className="text-[11px] text-fg-muted mt-2 bg-info-soft/50 p-2.5 rounded-lg border border-info/30">
                              {workflowPlan.summaryText}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {(() => {
                      const hasGuide = !!(guideOutput?.guideId || matchedGuide || selectedBooking.assignedGuide?.id || currentAssignment?.guideName);
                      const hasVehicle = !!(fleetOutput?.vehicleId || matchedVehicle || currentAssignment?.vehicleName);
                      const hasDriver = !!(fleetOutput?.driverId || matchedDriver || currentAssignment?.driverName);
                      const allAssigned = hasGuide && hasVehicle && hasDriver;

                      return (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                          {!allAssigned ? (
                            <span className="text-[11px] font-medium text-warning-fg bg-warning-soft px-2.5 py-1 rounded-lg border border-warning/30">
                              ⚠️ Cannot confirm: All 3 resources (Vehicle, Driver, Guide) must be allocated before approval.
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-success-fg bg-success-soft px-2.5 py-1 rounded-lg border border-success/30">
                              ✓ All 3 resources ready to be committed on approval.
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={handleApprovePlan}
                            disabled={approving || !allAssigned}
                            className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-purple-600 transition disabled:opacity-50"
                          >
                            {approving ? 'Confirming Allocation...' : 'Approve & Confirm Allocation'}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Smart Vehicle Availability Roster for the Selected Dates */}
              <div className="rounded-2xl border border-border bg-surface-raised p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <h3 className="font-heading text-sm font-bold text-fg">
                      Smart Vehicle Match &amp; Availability
                    </h3>
                    <p className="text-xs text-fg-muted">
                      Real-time conflict verification for {selectedBooking.startDate} to {selectedBooking.endDate}.
                    </p>
                  </div>
                  {checkingAvailability && (
                    <span className="text-xs font-medium text-brand-text animate-pulse">
                      Checking schedule conflicts...
                    </span>
                  )}
                </div>

                {/* Filter bar for Smart Vehicle Match list */}
                <div className="space-y-3 rounded-xl bg-surface-sunken p-3 border border-border text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-fg-muted font-semibold mb-1">Filter by Vehicle Type</label>
                      <select
                        value={vehicleTypeFilter}
                        onChange={(e) => setVehicleTypeFilter(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-fg focus:border-brand-500 focus:outline-none"
                      >
                        <option value="all">All Vehicle Types</option>
                        <option value="Van">Van</option>
                        <option value="Coach">Coach</option>
                        <option value="SUV">SUV</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-fg-muted font-semibold mb-1">Filter by Min Seats / Capacity</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 8 seats"
                        value={minSeatsFilter}
                        onChange={(e) => setMinSeatsFilter(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-fg focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Single Availability Filter Checkbox */}
                  <div className="flex items-center gap-3 pt-1 border-t border-border/80">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={onlyAvailableVehicles}
                        onChange={(e) => setOnlyAvailableVehicles(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-brand-text focus:ring-brand-500 cursor-pointer"
                      />
                      <span className="text-fg font-medium">
                        Show only available vehicles
                      </span>
                    </label>
                  </div>
                </div>

                {(() => {
                  const vehicleList = vehicles || [];
                  const filteredVehicles = vehicleList.filter((veh) => {
                    if (vehicleTypeFilter !== 'all' && veh.type !== vehicleTypeFilter) return false;
                    if (minSeatsFilter.trim() && veh.capacity < Number(minSeatsFilter)) return false;

                    const avail = availabilityMap[veh.id];
                    const isFree = avail ? avail.isAvailable : false;
                    const hasCapacity = veh.capacity >= selectedBooking.groupSize;
                    const isMaintenanceBlocked = veh.maintenanceStatus !== 'Available';
                    const canAssign = isFree && hasCapacity && !isMaintenanceBlocked;

                    // When ticked/marked: show only vehicles that are free of schedule conflicts, meet capacity, and not in maintenance
                    // When unticked/unmarked: show all vehicles (both available and unavailable/faded)
                    if (onlyAvailableVehicles && !canAssign) {
                      return false;
                    }

                    return true;
                  });

                  if (!vehicles || vehicles.length === 0) {
                    return <p className="text-xs text-fg-muted py-6 text-center">No vehicles in fleet.</p>;
                  }

                  if (filteredVehicles.length === 0) {
                    return (
                      <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-fg-muted bg-surface-sunken/50">
                        <p className="font-semibold text-fg">No vehicles match the selected criteria.</p>
                        <p className="mt-1 text-fg-muted">
                          Try adjusting your vehicle type, minimum seats, or unchecking the "Show only available vehicles" filter.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {filteredVehicles.map((veh) => {
                        const avail = availabilityMap[veh.id];
                        const isFree = avail ? avail.isAvailable : false;
                        const hasCapacity = veh.capacity >= selectedBooking.groupSize;
                        const isMaintenanceBlocked = veh.maintenanceStatus !== 'Available';
                        const canAssign = isFree && hasCapacity && !isMaintenanceBlocked;

                        return (
                          <div
                            key={veh.id}
                            className={`rounded-xl border p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              canAssign
                                ? 'border-border bg-surface-raised hover:border-brand-500/30 hover:shadow-xs'
                                : 'border-border bg-surface-sunken/70 opacity-60'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <VehicleTypeBadge type={veh.type} />
                                <span className="font-mono text-xs font-bold text-fg bg-neutral-soft px-2 py-0.5 rounded border border-border">
                                  {veh.registrationNumber || 'REG-PENDING'}
                                </span>
                                <span className="text-xs font-semibold text-fg">
                                  {veh.capacity} Seats
                                </span>
                                {veh.hasAC && (
                                  <span className="text-[10px] text-info-fg bg-info-soft px-1.5 py-0.5 rounded border border-info/30">
                                    AC
                                  </span>
                                )}
                              </div>

                              {/* Detailed Conflict or Availability Tags */}
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                {isMaintenanceBlocked ? (
                                  <span className="text-[11px] font-semibold text-danger-fg bg-danger-soft px-2 py-0.5 rounded border border-danger/30">
                                    {veh.maintenanceStatus === 'UnderMaintenance'
                                      ? 'Under Maintenance'
                                      : 'Out of Service'}
                                  </span>
                                ) : isFree ? (
                                  <span className="text-[11px] font-semibold text-success-fg bg-success-soft px-2 py-0.5 rounded border border-success/30">
                                    ✓ Available for these dates
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-semibold text-danger-fg bg-danger-soft px-2 py-0.5 rounded border border-danger/30">
                                    ✕ Unavailable for these dates (Existing Assignment)
                                  </span>
                                )}

                                {!hasCapacity && (
                                  <span className="text-[11px] font-semibold text-warning-fg bg-warning-soft px-2 py-0.5 rounded border border-warning/30">
                                    ⚠️ Capacity Shortfall ({veh.capacity} seats &lt; {selectedBooking.groupSize} pax)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="sm:text-right shrink-0">
                              <button
                                type="button"
                                disabled={!canAssign}
                                onClick={() => {
                                  setSelectedDriverId('');
                                  setAllocatingVehicle(veh);
                                }}
                                className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                                  canAssign
                                    ? 'bg-brand-700 text-white hover:bg-brand-600'
                                    : 'bg-neutral-soft text-fg-muted cursor-not-allowed'
                                }`}
                              >
                                Assign Vehicle
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Manual Allocation Modal with Smart Driver Conflict Detection */}
      {allocatingVehicle && selectedBooking && (() => {
        const hasExistingGuide = !!(selectedBooking.assignedGuide?.id || currentAssignment?.guideName);
        const existingGuideName = selectedBooking.assignedGuide?.name || currentAssignment?.guideName || 'Current Guide';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl bg-surface-raised p-6 shadow-xl animate-in fade-in zoom-in duration-150">
              <h2 className="font-heading text-lg font-bold text-fg">
                Confirm Vehicle, Driver &amp; Guide Allocation
              </h2>
              <p className="mt-1 text-xs text-fg-muted">
                Assign {allocatingVehicle.type} ({allocatingVehicle.registrationNumber}) to{' '}
                {selectedBooking.tourPackageName}.
              </p>

            <form onSubmit={handleConfirmAllocation} className="mt-4 space-y-4">
              <div className="rounded-xl bg-surface-sunken p-3 text-xs space-y-1.5 border border-border">
                <div className="flex justify-between">
                  <span className="text-fg-muted">Booking Dates:</span>
                  <span className="font-bold text-fg">
                    {selectedBooking.startDate} to {selectedBooking.endDate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Party Size:</span>
                  <span className="font-bold text-fg">
                    {selectedBooking.groupSize} Guests
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Vehicle Capacity:</span>
                  <span className="font-bold text-success-fg">
                    {allocatingVehicle.capacity} Seats (Fit OK)
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-fg">
                    Assign Driver (Conflict-Free Verification) *
                  </label>
                  {checkingDriverAvailability && (
                    <span className="text-[11px] text-brand-text animate-pulse">
                      Checking driver schedules...
                    </span>
                  )}
                </div>

                {drivers.length === 0 ? (
                  <p className="text-xs text-danger">
                    No drivers registered. Please register a driver in Drivers Roster first.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {drivers.map((d) => {
                      const avail = driverAvailabilityMap[d.id];
                      // If still checking or undefined, consider available or check status
                      const isFree = avail ? avail.isAvailable : true;
                      const isSelected = selectedDriverId === d.id;

                      return (
                        <div
                          key={d.id}
                          onClick={() => {
                            if (isFree) {
                              setSelectedDriverId(d.id);
                            }
                          }}
                          className={`rounded-xl border p-3 text-xs transition flex items-center justify-between ${
                            !isFree
                              ? 'border-border bg-surface-sunken/70 opacity-50 cursor-not-allowed'
                              : isSelected
                              ? 'border-brand-500 bg-brand-soft/50 ring-1 ring-brand-500 cursor-pointer'
                              : 'border-border bg-surface-raised hover:border-border hover:bg-surface-sunken/50 cursor-pointer'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-fg">{d.name}</span>
                              <span className="font-mono text-[10px] text-fg-muted bg-neutral-soft px-1.5 py-0.5 rounded border border-border">
                                {d.licenseNumber}
                              </span>
                            </div>
                            <p className="text-[11px] text-fg-muted">{d.contactInfo || 'No contact provided'}</p>
                            <div>
                              {isFree ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-success-fg text-[10px]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Available for these dates
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-semibold text-danger-fg text-[10px]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                  Unavailable for these dates (Booked)
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <input
                              type="radio"
                              name="assignedDriver"
                              value={d.id}
                              disabled={!isFree}
                              checked={isSelected}
                              onChange={() => isFree && setSelectedDriverId(d.id)}
                              className="h-4 w-4 border-border text-brand-text focus:ring-brand-500 disabled:opacity-40"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tour Guide Selection with Date Overlap Checks */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-fg">
                    Assign Tour Guide (Anti-Double-Booking Check)
                  </label>
                  {loadingGuides && (
                    <span className="text-[11px] text-info animate-pulse">
                      Checking guide schedules...
                    </span>
                  )}
                </div>

                {allGuides.length === 0 ? (
                  <p className="text-xs text-fg-muted">No guides registered in the system.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {/* Option to keep existing guide if already assigned */}
                    {hasExistingGuide ? (
                      <div
                        onClick={() => setSelectedGuideId('')}
                        className={`rounded-xl border p-2.5 text-xs transition flex items-center justify-between cursor-pointer ${
                          selectedGuideId === ''
                            ? 'border-info bg-info-soft/50 ring-1 ring-info'
                            : 'border-border bg-surface-raised hover:border-border'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="font-semibold text-fg">Keep Current Guide ({existingGuideName})</span>
                          <p className="text-[11px] text-fg-muted">Keep the previously assigned tour guide for this booking.</p>
                        </div>
                        <input
                          type="radio"
                          name="assignedGuide"
                          value=""
                          checked={selectedGuideId === ''}
                          onChange={() => setSelectedGuideId('')}
                          className="h-4 w-4 border-border text-info focus:ring-info"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-warning/30 bg-warning-soft/70 p-2.5 text-xs text-warning-fg">
                        <span className="font-semibold">⚠️ Guide Required: </span>
                        A booking requires all 3 resources (Vehicle, Driver, Guide) to be confirmed. Please select an available guide below.
                      </div>
                    )}

                    {allGuides.map((g) => {
                      const availItem = availableGuides.find((ag) => ag.guideId === g.id);
                      // If availableGuides contains it, guide is available for this date window
                      const isFree = !!availItem;
                      const isSelected = selectedGuideId === g.id;

                      return (
                        <div
                          key={g.id}
                          onClick={() => {
                            if (isFree) {
                              setSelectedGuideId(g.id);
                            }
                          }}
                          className={`rounded-xl border p-3 text-xs transition flex items-center justify-between ${
                            !isFree
                              ? 'border-border bg-surface-sunken/70 opacity-45 cursor-not-allowed'
                              : isSelected
                              ? 'border-info bg-info-soft/50 ring-1 ring-info cursor-pointer'
                              : 'border-border bg-surface-raised hover:border-border hover:bg-surface-sunken/50 cursor-pointer'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-fg">{g.name}</span>
                              {availItem?.matchesSpecialization && (
                                <span className="text-[10px] font-semibold text-info-fg bg-info-soft px-1.5 py-0.5 rounded border border-info/30">
                                  Theme Match
                                </span>
                              )}
                              {availItem?.matchesLanguage && (
                                <span className="text-[10px] font-semibold text-info-fg bg-info-soft px-1.5 py-0.5 rounded border border-info/30">
                                  Language Match
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-fg-muted">
                              {g.specializations?.join(', ') || 'General Guide'} &bull; {g.languages?.join(', ')}
                            </p>
                            <div>
                              {isFree ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-success-fg text-[10px]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Available for this tour window
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-semibold text-danger-fg text-[10px]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                  Unavailable (Date overlap / Booked)
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <input
                              type="radio"
                              name="assignedGuide"
                              value={g.id}
                              disabled={!isFree}
                              checked={isSelected}
                              onChange={() => isFree && setSelectedGuideId(g.id)}
                              className="h-4 w-4 border-border text-info focus:ring-info disabled:opacity-40"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAllocatingVehicle(null)}
                  disabled={allocating}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-fg-muted hover:bg-surface-sunken transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocating || !selectedDriverId || (!selectedGuideId && !hasExistingGuide)}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 transition disabled:opacity-50"
                >
                  {allocating ? 'Allocating Resources...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    })()}
    </div>
  );
}
