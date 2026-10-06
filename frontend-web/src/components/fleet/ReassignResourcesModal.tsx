import { useEffect, useState, type FormEvent } from 'react';
import { getAvailableGuidesForBooking, reassignResources, type AvailableGuideDto } from '../../api/bookings';
import { getGuides, type GuideDto } from '../../api/guides';
import {
  checkDriverAvailability,
  checkVehicleAvailability,
  getDrivers,
  getVehicles,
  type DriverDto,
  type VehicleAssignmentDetailDto,
  type VehicleDto,
} from '../../api/vehicles';
import { AlertCircle } from 'lucide-react';
import { Button, Input, Modal, Select } from '../ui';
import { notify } from '../ui/notify';
import { extractErrorMessage } from '../../api/apiClient';

interface ReassignResourcesModalProps {
  assignment: VehicleAssignmentDetailDto;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReassignResourcesModal({ assignment, onClose, onSuccess }: ReassignResourcesModalProps) {
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [drivers, setDrivers] = useState<DriverDto[]>([]);
  const [guides, setGuides] = useState<GuideDto[]>([]);
  const [availableGuides, setAvailableGuides] = useState<AvailableGuideDto[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Selected replacement IDs
  const [selectedVehicleId, setSelectedVehicleId] = useState(assignment.vehicleId);
  const [selectedDriverId, setSelectedDriverId] = useState(assignment.driverId);
  const [selectedGuideId, setSelectedGuideId] = useState(assignment.guideId || '');
  const [reason, setReason] = useState('');

  // Availability maps
  const [vehicleAvailability, setVehicleAvailability] = useState<Record<string, { isAvailable: boolean; reason?: string | null }>>({});
  const [driverAvailability, setDriverAvailability] = useState<Record<string, { isAvailable: boolean; reason?: string | null }>>({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Confirmation state
  const [showConfirmPrompt, setShowConfirmPrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingInitial(true);

    Promise.all([
      getVehicles(),
      getDrivers(),
      getGuides(),
      assignment.bookingId ? getAvailableGuidesForBooking(assignment.bookingId).catch(() => []) : Promise.resolve([]),
    ])
      .then(async ([vList, dList, gList, availGList]) => {
        if (!mounted) return;
        setVehicles(vList || []);
        setDrivers(dList || []);
        setGuides(gList || []);
        setAvailableGuides(availGList || []);

        setCheckingAvailability(true);
        const vMap: Record<string, { isAvailable: boolean; reason?: string | null }> = {};
        const dMap: Record<string, { isAvailable: boolean; reason?: string | null }> = {};

        // Perform date-range overlap availability checks for vehicles
        await Promise.all([
          ...vList.map(async (v) => {
            if (v.id === assignment.vehicleId) {
              vMap[v.id] = { isAvailable: true };
              return;
            }
            try {
              const res = await checkVehicleAvailability(v.id, assignment.startDate, assignment.endDate);
              vMap[v.id] = { isAvailable: res.isAvailable, reason: res.reason };
            } catch {
              vMap[v.id] = { isAvailable: false, reason: 'Check failed' };
            }
          }),
          ...dList.map(async (d) => {
            if (d.id === assignment.driverId) {
              dMap[d.id] = { isAvailable: true };
              return;
            }
            try {
              const res = await checkDriverAvailability(d.id, assignment.startDate, assignment.endDate);
              dMap[d.id] = { isAvailable: res.isAvailable, reason: res.reason };
            } catch {
              dMap[d.id] = { isAvailable: false, reason: 'Check failed' };
            }
          }),
        ]);

        if (mounted) {
          setVehicleAvailability(vMap);
          setDriverAvailability(dMap);
          setCheckingAvailability(false);
        }
      })
      .catch((err) => {
        notify.error(extractErrorMessage(err, 'Failed to load replacement options.'));
      })
      .finally(() => {
        if (mounted) setLoadingInitial(false);
      });

    return () => {
      mounted = false;
    };
  }, [assignment]);

  const hasVehicleChanged = selectedVehicleId !== assignment.vehicleId;
  const hasDriverChanged = selectedDriverId !== assignment.driverId;
  const hasGuideChanged = !!selectedGuideId && selectedGuideId !== assignment.guideId;
  const hasAnyChange = hasVehicleChanged || hasDriverChanged || hasGuideChanged;

  const currentVehicleSelected = vehicles.find((v) => v.id === selectedVehicleId);
  const currentDriverSelected = drivers.find((d) => d.id === selectedDriverId);
  const currentGuideSelected = guides.find((g) => g.id === selectedGuideId);

  const vehicleBlocked = selectedVehicleId !== assignment.vehicleId && vehicleAvailability[selectedVehicleId] && !vehicleAvailability[selectedVehicleId].isAvailable;
  const driverBlocked = selectedDriverId !== assignment.driverId && driverAvailability[selectedDriverId] && !driverAvailability[selectedDriverId].isAvailable;

  const canProceed = hasAnyChange && !vehicleBlocked && !driverBlocked && !submitting;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canProceed) return;
    setShowConfirmPrompt(true);
  }

  async function handleConfirmReassign() {
    if (!assignment.bookingId) return;
    setSubmitting(true);
    try {
      await reassignResources(assignment.bookingId, {
        vehicleId: selectedVehicleId,
        driverId: selectedDriverId,
        guideId: selectedGuideId || undefined,
        reason: reason.trim() || 'Operational emergency reassignment',
      });
      notify.success('Resources successfully reassigned! Traveler SMS notification dispatched.');
      setShowConfirmPrompt(false);
      onSuccess();
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Failed to reassign resources. Please verify schedule availability.'));
      setShowConfirmPrompt(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title="Emergency Resource Reassignment" className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-card border border-info/20 bg-info-soft/40 p-3.5 text-caption text-info-fg">
            <p className="font-semibold">Tour Booking: REF {assignment.bookingId?.slice(0, 8)}</p>
            <p className="text-fg-muted">
              Dates: <span className="font-semibold text-fg">{assignment.startDate} to {assignment.endDate}</span> | Traveler: {assignment.travelerName || 'Guest'}
            </p>
          </div>

          {loadingInitial || checkingAvailability ? (
            <div className="py-8 text-center text-caption text-fg-muted animate-pulse">
              Validating conflict-free schedules and fleet roster...
            </div>
          ) : (
            <>
              {/* Vehicle selector */}
              <div>
                <label className="mb-1 block text-caption font-semibold text-fg">
                  Vehicle (Breakdown Swap)
                </label>
                <Select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full"
                >
                  {vehicles.map((v) => {
                    const isOriginal = v.id === assignment.vehicleId;
                    const avail = vehicleAvailability[v.id]?.isAvailable ?? false;
                    const label = `${v.type} - ${v.registrationNumber || 'No Reg'} (${v.capacity} seats)${isOriginal ? ' [Current]' : !avail ? ' ✕ Booked / Conflict' : ' ✓ Available'}`;
                    return (
                      <option key={v.id} value={v.id} disabled={!isOriginal && !avail}>
                        {label}
                      </option>
                    );
                  })}
                </Select>
                {vehicleBlocked && (
                  <p className="mt-1 text-caption text-danger-fg">⚠️ Selected vehicle has a date conflict.</p>
                )}
              </div>

              {/* Driver selector */}
              <div>
                <label className="mb-1 block text-caption font-semibold text-fg">
                  Driver (Sickness / Absence Swap)
                </label>
                <Select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full"
                >
                  {drivers.map((d) => {
                    const isOriginal = d.id === assignment.driverId;
                    const avail = driverAvailability[d.id]?.isAvailable ?? false;
                    const label = `${d.name} (${d.contactInfo || 'No phone'})${isOriginal ? ' [Current]' : !avail ? ' ✕ Booked / Conflict' : ' ✓ Available'}`;
                    return (
                      <option key={d.id} value={d.id} disabled={!isOriginal && !avail}>
                        {label}
                      </option>
                    );
                  })}
                </Select>
                {driverBlocked && (
                  <p className="mt-1 text-caption text-danger-fg">⚠️ Selected driver has a date conflict.</p>
                )}
              </div>

              {/* Tour Guide selector */}
              <div>
                <label className="mb-1 block text-caption font-semibold text-fg">
                  Tour Guide (Emergency Replacement)
                </label>
                <Select
                  value={selectedGuideId}
                  onChange={(e) => setSelectedGuideId(e.target.value)}
                  className="w-full"
                >
                  <option value="">Keep / Use Current Guide ({assignment.guideName || 'Unassigned'})</option>
                  {guides.map((g) => {
                    const isAvail = availableGuides.some((ag) => ag.guideId === g.id);
                    const isCurrent = g.id === assignment.guideId;
                    const label = `${g.name} (${g.languages.join(', ')})${isCurrent ? ' [Current]' : isAvail ? ' ✓ Available' : ' ✕ Busy / Overlap'}`;
                    return (
                      <option key={g.id} value={g.id} disabled={!isCurrent && !isAvail}>
                        {label}
                      </option>
                    );
                  })}
                </Select>
              </div>

              {/* Reassignment Reason */}
              <div>
                <label className="mb-1 block text-caption font-semibold text-fg">
                  Reassignment Reason (Audit Trail)
                </label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Engine breakdown / Driver acute sickness"
                  className="w-full"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canProceed}>
                  Review &amp; Reassign
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* Safety Confirmation Prompt Modal */}
      {showConfirmPrompt && (
        <Modal
          open
          onClose={() => setShowConfirmPrompt(false)}
          title="Confirm Operational Reassignment"
          className="max-w-md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft p-3 text-warning-fg">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="text-caption">
                <p className="font-bold">Live Tour Resource Modification</p>
                <p className="mt-0.5">
                  This will release the previous allocation lock, assign the replacement resources transactionally, and immediately send an updated SMS notification to the traveler.
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-card border border-border bg-surface-sunken p-3 text-caption text-fg">
              <p>
                <span className="text-fg-muted">Vehicle:</span>{' '}
                <span className="font-semibold">{currentVehicleSelected?.type} ({currentVehicleSelected?.registrationNumber})</span>
              </p>
              <p>
                <span className="text-fg-muted">Driver:</span>{' '}
                <span className="font-semibold">{currentDriverSelected?.name} ({currentDriverSelected?.contactInfo})</span>
              </p>
              {currentGuideSelected && (
                <p>
                  <span className="text-fg-muted">Guide:</span>{' '}
                  <span className="font-semibold">{currentGuideSelected?.name}</span>
                </p>
              )}
              <p>
                <span className="text-fg-muted">Reason:</span>{' '}
                <span className="italic">{reason || 'Emergency replacement'}</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowConfirmPrompt(false)} disabled={submitting}>
                Go Back
              </Button>
              <Button onClick={handleConfirmReassign} disabled={submitting}>
                {submitting ? 'Applying Swap...' : 'Confirm & Notify Traveler'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
