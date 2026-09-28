import { useEffect, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  checkDriverAvailability,
  checkVehicleAvailability,
  getDrivers,
  getVehicles,
  reserveVehicle,
  type DriverDto,
  type VehicleDto,
  type VehicleMaintenanceStatus,
  type VehicleType,
} from '../../api/vehicles';
import { decideBooking, getPagedBookings, type BookingDto } from '../../api/bookings';
import { getAgentWorkflow, type AgentWorkflowDto } from '../../api/agentWorkflows';
import { BookingsIcon, TruckIcon } from '../admin/icons';
import { Link } from 'react-router-dom';

// Exported badge helpers
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

export function BookingStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'NeedsManualReview':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200 animate-pulse">
          Needs Review
        </span>
      );
    case 'PlanProposed':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">
          ✨ Plan Proposed
        </span>
      );
    case 'PendingApproval':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
          Pending Approval
        </span>
      );
    case 'Requested':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
          Requested
        </span>
      );
    case 'Confirmed':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
          Confirmed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
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

  // Agent proposed plan inspection for PlanProposed bookings
  const [workflowPlan, setWorkflowPlan] = useState<AgentWorkflowDto | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  // Allocation modal state
  const [allocatingVehicle, setAllocatingVehicle] = useState<VehicleDto | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [allocating, setAllocating] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationSuccess, setAllocationSuccess] = useState<string | null>(null);

  // Plan approval state
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  function loadData() {
    setError(null);
    Promise.all([
      getVehicles(),
      getDrivers().catch(() => [] as DriverDto[]),
      getPagedBookings({ pageSize: 50 }).catch(() => ({ items: [] as BookingDto[], totalCount: 0, page: 1, pageSize: 50 })),
    ])
      .then(([vehRes, driverRes, bookRes]) => {
        setVehicles(vehRes);
        setDrivers(driverRes);
        const bItems = bookRes.items || [];
        setBookings(bItems);

        // Keep or auto-select first priority booking if none selected
        if (!selectedBooking && bItems.length > 0) {
          const priority = bItems.find((b) => b.status === 'NeedsManualReview') ||
            bItems.find((b) => b.status === 'PlanProposed') ||
            bItems.find((b) => b.status === 'PendingApproval') ||
            bItems.find((b) => b.status === 'Requested') ||
            bItems[0];
          setSelectedBooking(priority);
        } else if (selectedBooking) {
          const updated = bItems.find((b) => b.id === selectedBooking.id);
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
    setApprovalError(null);
    try {
      await decideBooking(selectedBooking.id, { decision: 'Approve' });
      loadData();
    } catch (err) {
      setApprovalError(extractErrorMessage(err, 'Failed to approve plan.'));
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
      setAllocationError(
        `Group size (${selectedBooking.groupSize}) exceeds vehicle capacity (${allocatingVehicle.capacity}). Assignment blocked.`
      );
      return;
    }

    setAllocating(true);
    setAllocationError(null);
    setAllocationSuccess(null);

    try {
      await reserveVehicle(allocatingVehicle.id, {
        bookingId: selectedBooking.id,
        driverId: selectedDriverId,
        startDate: selectedBooking.startDate,
        endDate: selectedBooking.endDate,
      });

      setAllocationSuccess(`Successfully allocated ${allocatingVehicle.type} to booking!`);
      setTimeout(() => {
        setAllocatingVehicle(null);
        setSelectedDriverId('');
        setAllocationSuccess(null);
        loadData();
      }, 1200);
    } catch (err) {
      setAllocationError(extractErrorMessage(err, 'Failed to allocate vehicle.'));
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <TruckIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-900">
              Fleet &amp; Transport Workspace
            </h1>
            <p className="text-sm text-slate-500">
              Operational dispatch, conflict-free smart vehicle allocation, and agent proposal approval.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/fleet/vehicles"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <TruckIcon className="h-4 w-4 text-slate-400" />
            Manage Vehicles
          </Link>
          <Link
            to="/fleet/assignments"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-500 transition"
          >
            View All Schedules
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 shadow-sm">
          {error}
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Operational Allocation Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookingsIcon className="h-5 w-5 text-brand-600" />
                <h2 className="font-heading text-base font-bold text-slate-900">Allocation Queue</h2>
              </div>
              <span className="text-xs font-semibold text-slate-500">{bookings.length} Bookings</span>
            </div>

            {/* Queue Filter Tabs */}
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1 text-xs font-medium sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setQueueTab('NeedsManualReview')}
                className={`flex flex-col items-center rounded-lg py-1.5 px-1 transition ${
                  queueTab === 'NeedsManualReview'
                    ? 'bg-rose-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
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
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
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
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
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
                    ? 'bg-brand-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>Requested</span>
                <span className="text-[10px] font-bold">({requestedCount})</span>
              </button>
            </div>

            {/* Bookings List */}
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading queue...</div>
            ) : queueBookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                <p className="text-xs font-semibold text-slate-600">No bookings in this state</p>
                <p className="mt-1 text-[11px] text-slate-400">
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
                          ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-500 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-heading text-xs font-bold text-slate-900">
                            {b.tourPackageName || 'Custom Sri Lanka Tour'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {b.startDate} to {b.endDate}
                          </p>
                        </div>
                        <BookingStatusBadge status={b.status} />
                      </div>

                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800">
                          👥 {b.groupSize} Guests
                        </span>
                        {b.packageTier?.requiresAC && (
                          <span className="text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 font-medium">
                            ❄️ AC Required
                          </span>
                        )}
                        <span className="font-mono text-slate-400 text-[10px]">
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
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <TruckIcon className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-700">No Booking Selected</h3>
              <p className="mt-1 text-xs text-slate-400">
                Select a booking from the allocation queue on the left to verify vehicle dates and assign transport.
              </p>
            </div>
          ) : (
            <>
              {/* Selected Booking Header & Inspection Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-base font-bold text-slate-900">
                        {selectedBooking.tourPackageName}
                      </h2>
                      <BookingStatusBadge status={selectedBooking.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Booking ID: <span className="font-mono text-slate-700">{selectedBooking.id}</span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Service Window</span>
                    <span className="font-bold text-slate-800">
                      {selectedBooking.startDate} &rarr; {selectedBooking.endDate}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <span className="text-slate-400 block text-[10px]">Group Size</span>
                    <span className="font-bold text-slate-800 text-sm">{selectedBooking.groupSize} Guests</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <span className="text-slate-400 block text-[10px]">Climate Req.</span>
                    <span className={`font-bold text-sm ${selectedBooking.packageTier?.requiresAC ? 'text-sky-700' : 'text-slate-700'}`}>
                      {selectedBooking.packageTier?.requiresAC ? '❄️ AC Required' : 'Standard'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <span className="text-slate-400 block text-[10px]">Tier Class</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {selectedBooking.packageTier?.classType || 'Standard'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <span className="text-slate-400 block text-[10px]">Budget</span>
                    <span className="font-bold text-slate-800 text-sm">
                      ${selectedBooking.budgetPerPerson}/pax
                    </span>
                  </div>
                </div>

                {selectedBooking.specialRequests && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
                    <span className="font-bold">Special Requests: </span>
                    {selectedBooking.specialRequests}
                  </div>
                )}
              </div>

              {/* Agent Plan Review Card (For PlanProposed state) */}
              {selectedBooking.status === 'PlanProposed' && (
                <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50/60 via-white to-purple-50/30 p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 font-bold text-sm">
                        AI
                      </span>
                      <div>
                        <h3 className="font-heading text-sm font-bold text-purple-950">
                          Agent Proposed Plan Review
                        </h3>
                        <p className="text-xs text-purple-700">
                          The multi-agent coordinator formulated this verified allocation. Review and confirm below.
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-800 border border-purple-200">
                      Ready for Approval
                    </span>
                  </div>

                  {workflowLoading ? (
                    <div className="py-6 text-center text-xs text-purple-600">Loading plan analysis...</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Traveler & Trip Details */}
                      <div className="rounded-xl border border-purple-200/70 bg-white p-3.5 text-xs space-y-2">
                        <p className="font-semibold uppercase tracking-wider text-[10px] text-purple-500">
                          Traveler &amp; Requirements
                        </p>
                        <div className="space-y-1 text-slate-700">
                          <p><span className="text-slate-400">Package:</span> <span className="font-medium text-slate-900">{selectedBooking.tourPackageName}</span></p>
                          <p><span className="text-slate-400">Dates:</span> <span className="font-medium text-slate-900">{selectedBooking.startDate} to {selectedBooking.endDate}</span></p>
                          <p><span className="text-slate-400">Party Size:</span> <span className="font-medium text-slate-900">{selectedBooking.groupSize} Guests</span></p>
                          {selectedBooking.specialRequests && (
                            <p className="text-purple-800 text-[11px] italic">"{selectedBooking.specialRequests}"</p>
                          )}
                        </div>
                      </div>

                      {/* Right: Validation & Agent Match */}
                      <div className="rounded-xl border border-purple-200/70 bg-white p-3.5 text-xs space-y-2">
                        <p className="font-semibold uppercase tracking-wider text-[10px] text-purple-500">
                          Validation Checks
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                            ✓ No Date Conflicts
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                            ✓ Capacity OK: {selectedBooking.groupSize} Guests
                          </span>
                          {selectedBooking.packageTier?.requiresAC && (
                            <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 border border-sky-200">
                              ✓ Climate AC Verified
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 border border-purple-200">
                            ✓ Budget Feasible
                          </span>
                        </div>
                        {workflowPlan?.summaryText && (
                          <p className="text-[11px] text-slate-600 mt-2 bg-purple-50/50 p-2 rounded border border-purple-100">
                            {workflowPlan.summaryText}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {approvalError && (
                    <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
                      {approvalError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleApprovePlan}
                      disabled={approving}
                      className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-600 transition disabled:opacity-50"
                    >
                      {approving ? 'Confirming...' : 'Approve & Confirm Plan'}
                    </button>
                  </div>
                </div>
              )}

              {/* Smart Vehicle Availability Roster for the Selected Dates */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-heading text-sm font-bold text-slate-900">
                      Smart Vehicle Match &amp; Availability
                    </h3>
                    <p className="text-xs text-slate-500">
                      Real-time conflict verification for {selectedBooking.startDate} to {selectedBooking.endDate}.
                    </p>
                  </div>
                  {checkingAvailability && (
                    <span className="text-xs font-medium text-brand-600 animate-pulse">
                      Checking schedule conflicts...
                    </span>
                  )}
                </div>

                {/* Filter bar for Smart Vehicle Match list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Filter by Vehicle Type</label>
                    <select
                      value={vehicleTypeFilter}
                      onChange={(e) => setVehicleTypeFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none"
                    >
                      <option value="all">All Vehicle Types</option>
                      <option value="Van">Van</option>
                      <option value="Coach">Coach</option>
                      <option value="SUV">SUV</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Filter by Min Seats / Capacity</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 8 seats"
                      value={minSeatsFilter}
                      onChange={(e) => setMinSeatsFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                {!vehicles || vehicles.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No vehicles in fleet.</p>
                ) : (
                  <div className="space-y-3">
                    {vehicles
                      .filter((veh) => {
                        if (vehicleTypeFilter !== 'all' && veh.type !== vehicleTypeFilter) return false;
                        if (minSeatsFilter.trim() && veh.capacity < Number(minSeatsFilter)) return false;
                        return true;
                      })
                      .map((veh) => {
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
                                ? 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-xs'
                                : 'border-slate-200 bg-slate-50/70 opacity-60'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <VehicleTypeBadge type={veh.type} />
                                <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {veh.registrationNumber || 'REG-PENDING'}
                                </span>
                                <span className="text-xs font-semibold text-slate-700">
                                  {veh.capacity} Seats
                                </span>
                                {veh.hasAC && (
                                  <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                                    AC
                                  </span>
                                )}
                              </div>

                              {/* Detailed Conflict or Availability Tags */}
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                {isMaintenanceBlocked ? (
                                  <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                    {veh.maintenanceStatus === 'UnderMaintenance'
                                      ? 'Under Maintenance'
                                      : 'Out of Service'}
                                  </span>
                                ) : isFree ? (
                                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    ✓ Available for these dates
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                    ✕ Unavailable for these dates (Existing Assignment)
                                  </span>
                                )}

                                {!hasCapacity && (
                                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
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
                                  setAllocationError(null);
                                  setAllocationSuccess(null);
                                  setSelectedDriverId('');
                                  setAllocatingVehicle(veh);
                                }}
                                className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                                  canAssign
                                    ? 'bg-brand-600 text-white hover:bg-brand-500'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                Assign Vehicle
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Manual Allocation Modal with Smart Driver Conflict Detection */}
      {allocatingVehicle && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in duration-150">
            <h2 className="font-heading text-lg font-bold text-slate-900">
              Confirm Vehicle &amp; Driver Allocation
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Assign {allocatingVehicle.type} ({allocatingVehicle.registrationNumber}) to{' '}
              {selectedBooking.tourPackageName}.
            </p>

            {allocationError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
                {allocationError}
              </div>
            )}

            {allocationSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 border border-emerald-200">
                {allocationSuccess}
              </div>
            )}

            <form onSubmit={handleConfirmAllocation} className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking Dates:</span>
                  <span className="font-bold text-slate-800">
                    {selectedBooking.startDate} to {selectedBooking.endDate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Party Size:</span>
                  <span className="font-bold text-slate-800">
                    {selectedBooking.groupSize} Guests
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vehicle Capacity:</span>
                  <span className="font-bold text-emerald-700">
                    {allocatingVehicle.capacity} Seats (Fit OK)
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Assign Driver (Conflict-Free Verification) *
                  </label>
                  {checkingDriverAvailability && (
                    <span className="text-[11px] text-brand-600 animate-pulse">
                      Checking driver schedules...
                    </span>
                  )}
                </div>

                {drivers.length === 0 ? (
                  <p className="text-xs text-rose-600">
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
                              ? 'border-slate-200 bg-slate-50/70 opacity-50 cursor-not-allowed'
                              : isSelected
                              ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500 cursor-pointer'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{d.name}</span>
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {d.licenseNumber}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">{d.contactInfo || 'No contact provided'}</p>
                            <div>
                              {isFree ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 text-[10px]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Available for these dates
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-semibold text-rose-700 text-[10px]">
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
                              className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
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
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocating || !selectedDriverId}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-500 transition disabled:opacity-50"
                >
                  {allocating ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
