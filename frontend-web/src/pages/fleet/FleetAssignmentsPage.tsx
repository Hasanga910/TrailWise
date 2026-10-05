import { useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { getVehicleAssignments, type VehicleAssignmentDetailDto } from '../../api/vehicles';
import { CalendarIcon, TruckIcon } from '../../components/admin/icons';
import { VehicleTypeBadge } from '../../components/fleet/FleetManager';

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

  const inputClass =
    'w-full rounded-lg border border-border px-3 py-2 text-sm text-fg focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-surface-raised p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-fg">Vehicle Assignments & Schedules</h1>
            <p className="text-sm text-fg-muted">
              Track allocated vehicles, drivers, booking schedules, and historical cancellations.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Total Allocations</p>
          <p className="mt-2 text-2xl font-bold text-fg">{totalCount}</p>
          <p className="mt-1 text-xs text-fg-muted">All recorded assignments</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Active & Upcoming</p>
          <p className="mt-2 text-2xl font-bold text-brand-text">{activeCount}</p>
          <p className="mt-1 text-xs text-fg-muted">Operating or scheduled</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Completed Tours</p>
          <p className="mt-2 text-2xl font-bold text-fg-muted">{completedCount}</p>
          <p className="mt-1 text-xs text-fg-muted">Successfully concluded</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Cancelled / Released</p>
          <p className="mt-2 text-2xl font-bold text-danger">{cancelledCount}</p>
          <p className="mt-1 text-xs text-fg-muted">Released assignments</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-border bg-surface-raised p-5 shadow-sm space-y-4">
        {/* Status Tab buttons */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              filterType === 'all'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-surface-raised text-fg-muted hover:bg-neutral-soft border border-border'
            }`}
          >
            All Assignments ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('active')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              filterType === 'active'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-surface-raised text-fg-muted hover:bg-neutral-soft border border-border'
            }`}
          >
            Active & Upcoming ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('completed')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              filterType === 'completed'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-surface-raised text-fg-muted hover:bg-neutral-soft border border-border'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('cancelled')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              filterType === 'cancelled'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-surface-raised text-fg-muted hover:bg-neutral-soft border border-border'
            }`}
          >
            Cancelled ({cancelledCount})
          </button>
        </div>

        {/* Detailed Filter Inputs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Search Keywords</label>
            <input
              type="text"
              placeholder="Search driver, vehicle, traveler..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Vehicle Type</label>
            <select
              value={filterVehicleType}
              onChange={(e) => setFilterVehicleType(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Vehicle Types</option>
              <option value="Van">Van</option>
              <option value="Coach">Coach</option>
              <option value="SUV">SUV</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">From Date</label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">To Date</label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm font-medium text-danger-fg">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface-raised shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-sm text-fg-muted">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent mr-3" />
            Loading assignment records...
          </div>
        ) : filteredAssignments && filteredAssignments.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm text-fg-muted">
              <thead className="border-b border-border bg-surface-sunken/75 text-xs font-semibold uppercase tracking-wider text-fg-muted">
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
                      className={`transition-colors ${
                        isCancelled ? 'bg-danger-soft/30 text-fg-muted' : 'hover:bg-surface-sunken/50'
                      }`}
                    >
                      <td className="px-5 py-4 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {item.vehicleType && <VehicleTypeBadge type={item.vehicleType} />}
                          <span className={`font-semibold ${isCancelled ? 'line-through text-fg-muted' : 'text-fg'}`}>
                            {item.vehicleName}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          {item.registrationNumber ? (
                            <span className="font-mono font-bold text-fg bg-neutral-soft px-1.5 py-0.5 rounded border border-border">
                              {item.registrationNumber}
                            </span>
                          ) : (
                            <span className="font-mono text-fg-muted">ID: {item.vehicleId.slice(0, 8)}...</span>
                          )}
                          {item.hasAC && (
                            <span className="text-[11px] text-info-fg bg-info-soft px-1.5 py-0.5 rounded border border-info/30">
                              AC
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className={`font-semibold ${isCancelled ? 'text-fg-muted' : 'text-fg'}`}>
                          {item.driverName}
                        </div>
                        <div className="text-xs text-fg-muted">{item.driverContact || 'No contact provided'}</div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            title={item.bookingId}
                            className="font-mono text-xs font-semibold text-brand-text bg-brand-soft px-2 py-0.5 rounded border border-brand-500/30"
                          >
                            {item.bookingId.length > 8 ? `${item.bookingId.slice(0, 8)}...` : item.bookingId}
                          </span>
                          {item.travelerName && (
                            <span className="text-xs font-medium text-fg">({item.travelerName})</span>
                          )}
                        </div>
                        {item.bookingStatus && (
                          <div className="mt-1 text-[11px] text-fg-muted">
                            Booking: <span className="font-semibold">{item.bookingStatus}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs whitespace-nowrap">
                        <span className={`font-medium ${isCancelled ? 'text-fg-muted' : 'text-fg'}`}>
                          {item.startDate}
                        </span>
                        <span className="mx-1.5 text-fg-muted">to</span>
                        <span className={`font-medium ${isCancelled ? 'text-fg-muted' : 'text-fg'}`}>
                          {item.endDate}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger-fg ring-1 ring-inset ring-danger/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Cancelled (Released)
                          </span>
                        ) : isCurrent ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-fg ring-1 ring-inset ring-success/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            On Tour Today
                          </span>
                        ) : isPast ? (
                          <span className="inline-flex items-center rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-medium text-fg-muted">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 text-xs font-semibold text-info-fg ring-1 ring-inset ring-info/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            Scheduled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <TruckIcon className="mx-auto h-10 w-10 text-fg-muted" />
            <p className="mt-3 text-sm font-semibold text-fg">No vehicle assignments found.</p>
            <p className="mt-1 text-xs text-fg-muted">
              No assignments match your selected status, vehicle type, or date criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
