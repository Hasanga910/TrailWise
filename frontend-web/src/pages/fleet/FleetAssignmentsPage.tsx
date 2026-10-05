import { useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { getVehicleAssignments, type VehicleAssignmentDetailDto } from '../../api/vehicles';
import { CalendarIcon, TruckIcon } from '../../components/admin/icons';
import { VehicleTypeBadge } from '../../components/fleet/fleetBadges';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton, cn } from '../../components/ui';

export function FleetAssignmentsPage() {
  const [assignments, setAssignments] = useState<VehicleAssignmentDetailDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [filterVehicleType, setFilterVehicleType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  function loadAssignments() {
    setError(null);
    getVehicleAssignments()
      .then((data) => setAssignments(data))
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load vehicle assignments.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAssignments();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const totalCount = assignments?.length ?? 0;
  const activeCount =
    assignments?.filter((a) => a.bookingStatus !== 'Cancelled' && a.endDate >= todayStr).length ?? 0;
  const completedCount =
    assignments?.filter((a) => a.bookingStatus !== 'Cancelled' && a.endDate < todayStr).length ?? 0;
  const cancelledCount = assignments?.filter((a) => a.bookingStatus === 'Cancelled').length ?? 0;

  const filteredAssignments = assignments?.filter((a) => {
    const isCancelled = a.bookingStatus === 'Cancelled';
    const isPast = a.endDate < todayStr;
    const isActive = !isCancelled && !isPast;

    if (filterType === 'active' && !isActive) return false;
    if (filterType === 'completed' && (!isPast || isCancelled)) return false;
    if (filterType === 'cancelled' && !isCancelled) return false;

    if (filterVehicleType !== 'all' && a.vehicleType !== filterVehicleType) return false;

    if (startDateFilter && a.endDate < startDateFilter) return false;
    if (endDateFilter && a.startDate > endDateFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchVehicle = a.vehicleName?.toLowerCase().includes(q);
      const matchReg = a.registrationNumber?.toLowerCase().includes(q);
      const matchDriver = a.driverName?.toLowerCase().includes(q);
      const matchTraveler = a.travelerName?.toLowerCase().includes(q);
      const matchBooking = a.bookingId?.toLowerCase().includes(q);
      if (!matchVehicle && !matchReg && !matchDriver && !matchTraveler && !matchBooking) return false;
    }

    return true;
  });

  const tabs: { id: typeof filterType; label: string; count: number }[] = [
    { id: 'all', label: 'All Assignments', count: totalCount },
    { id: 'active', label: 'Active & Upcoming', count: activeCount },
    { id: 'completed', label: 'Completed', count: completedCount },
    { id: 'cancelled', label: 'Cancelled', count: cancelledCount },
  ];

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-card bg-brand-soft text-brand-text">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <PageHeader
            as="h1"
            title="Vehicle Assignments & Schedules"
            description="Track allocated vehicles, drivers, booking schedules, and historical cancellations."
            className="mb-0"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Allocations', value: totalCount, hint: 'All recorded assignments', color: 'text-fg' },
          { label: 'Active & Upcoming', value: activeCount, hint: 'Operating or scheduled', color: 'text-brand-text' },
          { label: 'Completed Tours', value: completedCount, hint: 'Successfully concluded', color: 'text-fg-muted' },
          { label: 'Cancelled / Released', value: cancelledCount, hint: 'Released assignments', color: 'text-danger-fg' },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-overline text-fg-muted">{stat.label}</p>
            <p className={`mt-2 font-heading text-h2 ${stat.color}`}>{stat.value}</p>
            <p className="mt-1 text-caption text-fg-muted">{stat.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              size="sm"
              variant={filterType === tab.id ? (tab.id === 'cancelled' ? 'danger' : 'primary') : 'secondary'}
              onClick={() => setFilterType(tab.id)}
            >
              {tab.label} ({tab.count})
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search Keywords"
            type="text"
            placeholder="Search driver, vehicle, traveler..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select label="Vehicle Type" value={filterVehicleType} onChange={(e) => setFilterVehicleType(e.target.value)}>
            <option value="all">All Vehicle Types</option>
            <option value="Van">Van</option>
            <option value="Coach">Coach</option>
            <option value="SUV">SUV</option>
          </Select>
          <Input label="From Date" type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} />
          <Input label="To Date" type="date" value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)} />
        </div>
      </Card>

      {error && (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-body font-medium text-danger-fg">
          {error}
        </div>
      )}

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6" role="status" aria-label="Loading assignment records">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
            <span className="sr-only">Loading assignment records...</span>
          </div>
        ) : filteredAssignments && filteredAssignments.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-body text-fg-muted">
              <thead className="border-b border-border bg-surface-sunken text-caption font-semibold uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="px-5 py-4">Vehicle Details</th>
                  <th className="px-5 py-4">Assigned Driver</th>
                  <th className="px-5 py-4">Booking & Traveler</th>
                  <th className="px-5 py-4">Service Period</th>
                  <th className="px-5 py-4">Assignment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssignments.map((item) => {
                  const isCancelled = item.bookingStatus === 'Cancelled';
                  const isPast = item.endDate < todayStr;
                  const isCurrent = !isCancelled && item.startDate <= todayStr && item.endDate >= todayStr;

                  return (
                    <tr
                      key={item.id}
                      className={cn('transition-colors', isCancelled ? 'bg-danger-soft/30 text-fg-muted' : 'hover:bg-surface-sunken/50')}
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-medium">
                        <div className="flex items-center gap-2">
                          {item.vehicleType && <VehicleTypeBadge type={item.vehicleType} />}
                          <span className={cn('font-semibold', isCancelled ? 'text-fg-muted line-through' : 'text-fg')}>
                            {item.vehicleName}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-caption">
                          {item.registrationNumber ? (
                            <span className="rounded border border-border bg-neutral-soft px-1.5 py-0.5 font-mono font-bold text-fg">
                              {item.registrationNumber}
                            </span>
                          ) : (
                            <span className="font-mono text-fg-muted">ID: {item.vehicleId.slice(0, 8)}...</span>
                          )}
                          {item.hasAC && <Badge tone="info">AC</Badge>}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <div className={cn('font-semibold', isCancelled ? 'text-fg-muted' : 'text-fg')}>{item.driverName}</div>
                        <div className="text-caption text-fg-muted">{item.driverContact || 'No contact provided'}</div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Badge tone="brand" title={item.bookingId} className="font-mono">
                            {item.bookingId.length > 8 ? `${item.bookingId.slice(0, 8)}...` : item.bookingId}
                          </Badge>
                          {item.travelerName && <span className="text-caption font-medium text-fg">({item.travelerName})</span>}
                        </div>
                        {item.bookingStatus && (
                          <div className="mt-1 text-caption text-fg-muted">
                            Booking: <span className="font-semibold">{item.bookingStatus}</span>
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-caption">
                        <span className={cn('font-medium', isCancelled ? 'text-fg-muted' : 'text-fg')}>{item.startDate}</span>
                        <span className="mx-1.5 text-fg-muted">to</span>
                        <span className={cn('font-medium', isCancelled ? 'text-fg-muted' : 'text-fg')}>{item.endDate}</span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        {isCancelled ? (
                          <Badge tone="danger" className="gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
                            Cancelled (Released)
                          </Badge>
                        ) : isCurrent ? (
                          <Badge tone="success" className="gap-1.5">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden />
                            On Tour Today
                          </Badge>
                        ) : isPast ? (
                          <Badge>Completed</Badge>
                        ) : (
                          <Badge tone="info" className="gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-info" aria-hidden />
                            Scheduled
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<TruckIcon className="h-8 w-8" />}
            title="No vehicle assignments found."
            description="No assignments match your selected status, vehicle type, or date criteria."
          />
        )}
      </Card>
    </div>
  );
}
