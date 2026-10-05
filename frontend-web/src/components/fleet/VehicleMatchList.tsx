import type { BookingDto } from '../../api/bookings';
import type { VehicleDto } from '../../api/vehicles';
import { Badge, Button, Card, Checkbox, EmptyState, Input, Select, cn } from '../ui';
import { VehicleTypeBadge } from './fleetBadges';

export type AvailabilityMap = Record<string, { isAvailable: boolean; reason?: string | null }>;

interface VehicleMatchListProps {
  booking: BookingDto;
  vehicles: VehicleDto[] | null;
  availabilityMap: AvailabilityMap;
  checking: boolean;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  minSeats: string;
  onMinSeatsChange: (value: string) => void;
  onlyAvailable: boolean;
  onOnlyAvailableChange: (value: boolean) => void;
  onAssign: (vehicle: VehicleDto) => void;
}

/** Smart vehicle roster for the selected booking's dates, with capacity and conflict checks. */
export function VehicleMatchList({
  booking,
  vehicles,
  availabilityMap,
  checking,
  typeFilter,
  onTypeFilterChange,
  minSeats,
  onMinSeatsChange,
  onlyAvailable,
  onOnlyAvailableChange,
  onAssign,
}: VehicleMatchListProps) {
  function assess(veh: VehicleDto) {
    const avail = availabilityMap[veh.id];
    const isFree = avail ? avail.isAvailable : false;
    const hasCapacity = veh.capacity >= booking.groupSize;
    const isMaintenanceBlocked = veh.maintenanceStatus !== 'Available';
    return { isFree, hasCapacity, isMaintenanceBlocked, canAssign: isFree && hasCapacity && !isMaintenanceBlocked };
  }

  const vehicleList = vehicles || [];
  const filteredVehicles = vehicleList.filter((veh) => {
    if (typeFilter !== 'all' && veh.type !== typeFilter) return false;
    if (minSeats.trim() && veh.capacity < Number(minSeats)) return false;
    // Ticked: only vehicles free of conflicts, with capacity, not in maintenance. Unticked: show all (unavailable ones faded).
    if (onlyAvailable && !assess(veh).canAssign) return false;
    return true;
  });

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-h4 text-fg">Smart Vehicle Match &amp; Availability</h3>
          <p className="text-caption text-fg-muted">
            Real-time conflict verification for {booking.startDate} to {booking.endDate}.
          </p>
        </div>
        {checking && (
          <span className="animate-pulse text-caption font-medium text-brand-text">Checking schedule conflicts...</span>
        )}
      </div>

      <div className="space-y-3 rounded-card border border-border bg-surface-sunken p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Filter by Vehicle Type" value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)}>
            <option value="all">All Vehicle Types</option>
            <option value="Van">Van</option>
            <option value="Coach">Coach</option>
            <option value="SUV">SUV</option>
          </Select>
          <Input
            label="Filter by Min Seats / Capacity"
            type="number"
            min="1"
            placeholder="e.g. 8 seats"
            value={minSeats}
            onChange={(e) => onMinSeatsChange(e.target.value)}
          />
        </div>

        <div className="border-t border-border pt-3">
          <Checkbox
            label="Show only available vehicles"
            checked={onlyAvailable}
            onChange={(e) => onOnlyAvailableChange(e.target.checked)}
          />
        </div>
      </div>

      {!vehicles || vehicles.length === 0 ? (
        <p className="py-6 text-center text-caption text-fg-muted">No vehicles in fleet.</p>
      ) : filteredVehicles.length === 0 ? (
        <EmptyState
          title="No vehicles match the selected criteria."
          description='Try adjusting your vehicle type, minimum seats, or unchecking the "Show only available vehicles" filter.'
          className="rounded-card border border-dashed border-border bg-surface-sunken py-8"
        />
      ) : (
        <div className="max-h-[580px] space-y-3 overflow-y-auto pr-1.5">
          {filteredVehicles.map((veh) => {
            const { isFree, hasCapacity, isMaintenanceBlocked, canAssign } = assess(veh);
            return (
              <div
                key={veh.id}
                className={cn(
                  'flex flex-col justify-between gap-3 rounded-card border border-border p-4 transition sm:flex-row sm:items-center',
                  canAssign ? 'bg-surface-raised' : 'bg-surface-sunken opacity-60',
                )}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <VehicleTypeBadge type={veh.type} />
                    <span className="rounded border border-border bg-neutral-soft px-2 py-0.5 font-mono text-caption font-bold text-fg">
                      {veh.registrationNumber || 'REG-PENDING'}
                    </span>
                    <span className="text-caption font-semibold text-fg">{veh.capacity} Seats</span>
                    {veh.hasAC && <Badge tone="info">AC</Badge>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {isMaintenanceBlocked ? (
                      <Badge tone="danger">
                        {veh.maintenanceStatus === 'UnderMaintenance' ? 'Under Maintenance' : 'Out of Service'}
                      </Badge>
                    ) : isFree ? (
                      <Badge tone="success">✓ Available for these dates</Badge>
                    ) : (
                      <Badge tone="danger">✕ Unavailable for these dates (Existing Assignment)</Badge>
                    )}

                    {!hasCapacity && (
                      <Badge tone="warning">
                        ⚠️ Capacity Shortfall ({veh.capacity} seats &lt; {booking.groupSize} pax)
                      </Badge>
                    )}
                  </div>
                </div>

                <Button className="shrink-0" disabled={!canAssign} onClick={() => onAssign(veh)}>
                  Assign Vehicle
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
