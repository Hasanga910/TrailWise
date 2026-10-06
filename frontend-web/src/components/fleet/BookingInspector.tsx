import type { BookingDto } from '../../api/bookings';
import type { VehicleAssignmentDetailDto } from '../../api/vehicles';
import { Card } from '../ui';
import { BookingStatusBadge } from './fleetBadges';

/** Header card for the selected booking, with its current vehicle, driver and guide assignment. */
export function BookingInspector({
  booking,
  assignment,
  onReassign,
}: {
  booking: BookingDto;
  assignment: VehicleAssignmentDetailDto | null;
  onReassign?: () => void;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-h4 text-fg">{booking.tourPackageName}</h2>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="mt-0.5 text-caption text-fg-muted">
            Booking ID: <span className="font-mono text-fg">{booking.id}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {booking.status === 'Confirmed' && assignment && onReassign && (
            <button
              type="button"
              onClick={onReassign}
              className="rounded-input border border-warning/40 bg-warning-soft px-3 py-1.5 text-caption font-semibold text-warning-fg hover:bg-warning-soft/80 transition"
            >
              🔄 Reassign Resources
            </button>
          )}

          <div className="rounded-input border border-border bg-surface-sunken px-3 py-1.5 text-right text-caption">
            <span className="block text-overline uppercase text-fg-muted">Service Window</span>
            <span className="font-bold text-fg">
              {booking.startDate} &rarr; {booking.endDate}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-caption sm:grid-cols-4">
        <div className="rounded-input bg-surface-sunken p-2.5">
          <span className="block text-fg-muted">Group Size</span>
          <span className="text-body font-bold text-fg">{booking.groupSize} Guests</span>
        </div>
        <div className="rounded-input bg-surface-sunken p-2.5">
          <span className="block text-fg-muted">Climate Req.</span>
          <span className={`text-body font-bold ${booking.packageTier?.requiresAC ? 'text-info-fg' : 'text-fg'}`}>
            {booking.packageTier?.requiresAC ? '❄️ AC Required' : 'Standard'}
          </span>
        </div>
        <div className="rounded-input bg-surface-sunken p-2.5">
          <span className="block text-fg-muted">Tier Class</span>
          <span className="text-body font-bold text-fg">{booking.packageTier?.classType || 'Standard'}</span>
        </div>
        <div className="rounded-input bg-surface-sunken p-2.5">
          <span className="block text-fg-muted">Budget</span>
          <span className="text-body font-bold text-fg">${booking.budgetPerPerson}/pax</span>
        </div>
      </div>

      {booking.specialRequests && (
        <div className="rounded-card border border-warning/30 bg-warning-soft p-3 text-caption text-warning-fg">
          <span className="font-bold">Special Requests: </span>
          {booking.specialRequests}
        </div>
      )}

      {assignment && (
        <div className="flex flex-col justify-between gap-3 rounded-card border border-success/30 bg-success-soft p-4 text-caption text-success-fg sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-input bg-success text-white">🚐</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body font-bold">{assignment.vehicleName}</span>
                {assignment.registrationNumber && (
                  <span className="rounded border border-success/30 bg-surface-raised px-1.5 py-0.5 font-mono font-bold">
                    {assignment.registrationNumber}
                  </span>
                )}
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-overline font-semibold uppercase">
                  Vehicle Assigned
                </span>
              </div>
              <p className="mt-0.5">
                Assigned Driver: <span className="font-semibold">{assignment.driverName}</span>{' '}
                {assignment.driverContact ? `(${assignment.driverContact})` : ''}
              </p>
              {assignment.guideName && (
                <p className="mt-0.5 text-info-fg">
                  Assigned Guide: <span className="font-semibold">{assignment.guideName}</span>{' '}
                  {assignment.guideContact ? `(${assignment.guideContact})` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {booking.status === 'Confirmed' && onReassign && (
              <button
                type="button"
                onClick={onReassign}
                className="rounded-input border border-border bg-surface-raised px-2.5 py-1 font-semibold text-fg hover:bg-surface-sunken transition"
              >
                Swap / Reassign
              </button>
            )}
            <span className="rounded-input border border-success/30 bg-surface-raised px-2.5 py-1 font-medium">
              Confirmed Dispatch
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
