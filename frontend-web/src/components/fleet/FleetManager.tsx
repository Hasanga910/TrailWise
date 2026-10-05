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
import { TruckIcon } from '../admin/icons';
import { Link } from 'react-router-dom';
import { Card, EmptyState, PageHeader, buttonClasses } from '../ui';
import { notify } from '../ui/notify';
import { AgentPlanReview } from './AgentPlanReview';
import { AllocationModal } from './AllocationModal';
import { AllocationQueue, type QueueTab } from './AllocationQueue';
import { BookingInspector } from './BookingInspector';
import { VehicleMatchList } from './VehicleMatchList';

// Badge helpers live in fleetBadges; re-exported so existing imports keep working.
export { BookingStatusBadge, StatusBadge, VehicleTypeBadge } from './fleetBadges';

export function FleetManager() {
  const [vehicles, setVehicles] = useState<VehicleDto[] | null>(null);
  const [drivers, setDrivers] = useState<DriverDto[]>([]);
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active queue tab filter: NeedsManualReview (main priority), PlanProposed, PendingApproval, Requested, All
  const [queueTab, setQueueTab] = useState<QueueTab>('NeedsManualReview');

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

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand-text">
            <TruckIcon className="h-6 w-6" />
          </div>
          <PageHeader
            as="h1"
            title="Fleet & Transport Workspace"
            description="Operational dispatch, conflict-free smart vehicle allocation, and agent proposal approval."
            className="mb-0"
          />
        </div>

        <div className="flex items-center gap-3">
          <Link to="/fleet/vehicles" className={buttonClasses('secondary', 'sm')}>
            <TruckIcon className="h-4 w-4 text-fg-muted" />
            Manage Vehicles
          </Link>
          <Link to="/fleet/assignments" className={buttonClasses('primary', 'sm')}>
            View All Schedules
          </Link>
        </div>
      </Card>

      {error && (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-body font-medium text-danger-fg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <AllocationQueue
            bookings={bookings}
            loading={loading}
            tab={queueTab}
            onTabChange={setQueueTab}
            selectedId={selectedBooking?.id}
            onSelect={setSelectedBooking}
          />
        </div>

        <div className="space-y-5 lg:col-span-7">
          {!selectedBooking ? (
            <Card padded={false} className="border-dashed">
              <EmptyState
                icon={<TruckIcon className="h-8 w-8" />}
                title="No Booking Selected"
                description="Select a booking from the allocation queue on the left to verify vehicle dates and assign transport."
                className="py-12"
              />
            </Card>
          ) : (
            <>
              <BookingInspector booking={selectedBooking} assignment={currentAssignment} />

              {selectedBooking.status === 'PlanProposed' && (
                <AgentPlanReview
                  booking={selectedBooking}
                  workflowPlan={workflowPlan}
                  workflowLoading={workflowLoading}
                  allGuides={allGuides}
                  vehicles={vehicles}
                  drivers={drivers}
                  currentAssignment={currentAssignment}
                  approving={approving}
                  onApprove={handleApprovePlan}
                />
              )}

              <VehicleMatchList
                booking={selectedBooking}
                vehicles={vehicles}
                availabilityMap={availabilityMap}
                checking={checkingAvailability}
                typeFilter={vehicleTypeFilter}
                onTypeFilterChange={setVehicleTypeFilter}
                minSeats={minSeatsFilter}
                onMinSeatsChange={setMinSeatsFilter}
                onlyAvailable={onlyAvailableVehicles}
                onOnlyAvailableChange={setOnlyAvailableVehicles}
                onAssign={(veh) => {
                  setSelectedDriverId('');
                  setAllocatingVehicle(veh);
                }}
              />
            </>
          )}
        </div>
      </div>

      {allocatingVehicle && selectedBooking && (
        <AllocationModal
          vehicle={allocatingVehicle}
          booking={selectedBooking}
          currentAssignment={currentAssignment}
          drivers={drivers}
          driverAvailabilityMap={driverAvailabilityMap}
          checkingDrivers={checkingDriverAvailability}
          allGuides={allGuides}
          availableGuides={availableGuides}
          loadingGuides={loadingGuides}
          selectedDriverId={selectedDriverId}
          onSelectDriver={setSelectedDriverId}
          selectedGuideId={selectedGuideId}
          onSelectGuide={setSelectedGuideId}
          allocating={allocating}
          onClose={() => setAllocatingVehicle(null)}
          onSubmit={handleConfirmAllocation}
        />
      )}
    </div>
  );
}
