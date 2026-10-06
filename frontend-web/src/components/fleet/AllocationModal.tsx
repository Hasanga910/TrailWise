import type { FormEvent } from 'react';
import type { AvailableGuideDto, BookingDto } from '../../api/bookings';
import type { GuideDto } from '../../api/guides';
import type { DriverDto, VehicleAssignmentDetailDto, VehicleDto } from '../../api/vehicles';
import { Badge, Button, Modal, cn } from '../ui';
import type { AvailabilityMap } from './VehicleMatchList';

interface AllocationModalProps {
  vehicle: VehicleDto;
  booking: BookingDto;
  currentAssignment: VehicleAssignmentDetailDto | null;
  drivers: DriverDto[];
  driverAvailabilityMap: AvailabilityMap;
  checkingDrivers: boolean;
  allGuides: GuideDto[];
  availableGuides: AvailableGuideDto[];
  loadingGuides: boolean;
  selectedDriverId: string;
  onSelectDriver: (id: string) => void;
  selectedGuideId: string;
  onSelectGuide: (id: string) => void;
  allocating: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}

function AvailabilityNote({ free, freeText, busyText }: { free: boolean; freeText: string; busyText: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-overline font-semibold', free ? 'text-success-fg' : 'text-danger-fg')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', free ? 'bg-success' : 'bg-danger')} aria-hidden />
      {free ? freeText : busyText}
    </span>
  );
}

/** Confirm which driver and guide go with the chosen vehicle, with schedule-conflict checks. */
export function AllocationModal({
  vehicle,
  booking,
  currentAssignment,
  drivers,
  driverAvailabilityMap,
  checkingDrivers,
  allGuides,
  availableGuides,
  loadingGuides,
  selectedDriverId,
  onSelectDriver,
  selectedGuideId,
  onSelectGuide,
  allocating,
  onClose,
  onSubmit,
}: AllocationModalProps) {
  const hasExistingGuide = !!(booking.assignedGuide?.id || currentAssignment?.guideName);
  const existingGuideName = booking.assignedGuide?.name || currentAssignment?.guideName || 'Current Guide';

  return (
    <Modal
      open
      onClose={() => {
        if (!allocating) onClose();
      }}
      size="lg"
      title="Confirm Vehicle, Driver & Guide Allocation"
      description={`Assign ${vehicle.type} (${vehicle.registrationNumber}) to ${booking.tourPackageName}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={allocating}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="allocation-form"
            disabled={allocating || !selectedDriverId || (!selectedGuideId && !hasExistingGuide)}
          >
            {allocating ? 'Allocating Resources...' : 'Confirm Allocation'}
          </Button>
        </>
      }
    >
      <form id="allocation-form" onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5 rounded-card border border-border bg-surface-sunken p-3 text-caption">
          <div className="flex justify-between">
            <span className="text-fg-muted">Booking Dates:</span>
            <span className="font-bold text-fg">
              {booking.startDate} to {booking.endDate}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-muted">Party Size:</span>
            <span className="font-bold text-fg">{booking.groupSize} Guests</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-muted">Vehicle Capacity:</span>
            <span className="font-bold text-success-fg">{vehicle.capacity} Seats (Fit OK)</span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="block text-caption font-semibold text-fg">Assign Driver (Conflict-Free Verification) *</span>
            {checkingDrivers && <span className="animate-pulse text-caption text-brand-text">Checking driver schedules...</span>}
          </div>

          {drivers.length === 0 ? (
            <p className="text-caption text-danger-fg">
              No drivers registered. Please register a driver in Drivers Roster first.
            </p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {drivers.map((d) => {
                const avail = driverAvailabilityMap[d.id];
                const isFree = avail ? avail.isAvailable : true;
                const isSelected = selectedDriverId === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      if (isFree) onSelectDriver(d.id);
                    }}
                    className={cn(
                      'flex items-center justify-between rounded-card border p-3 text-caption transition',
                      !isFree
                        ? 'cursor-not-allowed border-border bg-surface-sunken opacity-50'
                        : isSelected
                          ? 'cursor-pointer border-brand-500 bg-brand-soft/50 ring-1 ring-brand-500'
                          : 'cursor-pointer border-border bg-surface-raised hover:bg-surface-sunken',
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-fg">{d.name}</span>
                        <span className="rounded border border-border bg-neutral-soft px-1.5 py-0.5 font-mono text-fg-muted">
                          {d.licenseNumber}
                        </span>
                      </div>
                      <p className="text-fg-muted">{d.contactInfo || 'No contact provided'}</p>
                      <AvailabilityNote
                        free={isFree}
                        freeText="Available for these dates"
                        busyText="Unavailable for these dates (Booked)"
                      />
                    </div>

                    <input
                      type="radio"
                      name="assignedDriver"
                      value={d.id}
                      disabled={!isFree}
                      checked={isSelected}
                      onChange={() => isFree && onSelectDriver(d.id)}
                      className="h-4 w-4 accent-brand-600 disabled:opacity-40"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="block text-caption font-semibold text-fg">Assign Tour Guide (Anti-Double-Booking Check)</span>
            {loadingGuides && <span className="animate-pulse text-caption text-info-fg">Checking guide schedules...</span>}
          </div>

          {allGuides.length === 0 ? (
            <p className="text-caption text-fg-muted">No guides registered in the system.</p>
          ) : (
            <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {hasExistingGuide ? (
                <div
                  onClick={() => onSelectGuide('')}
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-card border p-2.5 text-caption transition',
                    selectedGuideId === '' ? 'border-info bg-info-soft ring-1 ring-info' : 'border-border bg-surface-raised hover:bg-surface-sunken',
                  )}
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-fg">Keep Current Guide ({existingGuideName})</span>
                    <p className="text-fg-muted">Keep the previously assigned tour guide for this booking.</p>
                  </div>
                  <input
                    type="radio"
                    name="assignedGuide"
                    value=""
                    checked={selectedGuideId === ''}
                    onChange={() => onSelectGuide('')}
                    className="h-4 w-4 accent-brand-600"
                  />
                </div>
              ) : (
                <div className="rounded-card border border-warning/30 bg-warning-soft p-2.5 text-caption text-warning-fg">
                  <span className="font-semibold">⚠️ Guide Required: </span>
                  A booking requires all 3 resources (Vehicle, Driver, Guide) to be confirmed. Please select an available guide below.
                </div>
              )}

              {allGuides.map((g) => {
                const availItem = availableGuides.find((ag) => ag.guideId === g.id);
                const isFree = !!availItem;
                const isSelected = selectedGuideId === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => {
                      if (isFree) onSelectGuide(g.id);
                    }}
                    className={cn(
                      'flex items-center justify-between rounded-card border p-3 text-caption transition',
                      !isFree
                        ? 'cursor-not-allowed border-border bg-surface-sunken opacity-45'
                        : isSelected
                          ? 'cursor-pointer border-info bg-info-soft ring-1 ring-info'
                          : 'cursor-pointer border-border bg-surface-raised hover:bg-surface-sunken',
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-fg">{g.name}</span>
                        {availItem?.matchesSpecialization && <Badge tone="info">Theme Match</Badge>}
                        {availItem?.matchesLanguage && <Badge tone="info">Language Match</Badge>}
                      </div>
                      <p className="text-fg-muted">
                        {g.specializations?.join(', ') || 'General Guide'} &bull; {g.languages?.join(', ')}
                      </p>
                      <AvailabilityNote
                        free={isFree}
                        freeText="Available for this tour window"
                        busyText="Unavailable (Date overlap / Booked)"
                      />
                    </div>

                    <input
                      type="radio"
                      name="assignedGuide"
                      value={g.id}
                      disabled={!isFree}
                      checked={isSelected}
                      onChange={() => isFree && onSelectGuide(g.id)}
                      className="h-4 w-4 accent-brand-600 disabled:opacity-40"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
