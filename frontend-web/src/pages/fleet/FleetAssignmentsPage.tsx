import { useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { getVehicleAssignments, type VehicleAssignmentDetailDto } from '../../api/vehicles';
import { CalendarIcon } from '../../components/admin/icons';

export function FleetAssignmentsPage() {
  const [assignments, setAssignments] = useState<VehicleAssignmentDetailDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'past'>('all');

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

  const filteredAssignments = assignments?.filter((a) => {
    if (filterType === 'upcoming') {
      return a.endDate >= todayStr;
    }
    if (filterType === 'past') {
      return a.endDate < todayStr;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-900">Vehicle Assignments</h1>
            <p className="text-sm text-slate-500">
              Track allocated vehicles, drivers, associated bookings, and active tour schedules.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Allocations</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{assignments?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active / Upcoming</p>
          <p className="mt-2 text-2xl font-bold text-brand-600">
            {assignments?.filter((a) => a.endDate >= todayStr).length ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completed Tours</p>
          <p className="mt-2 text-2xl font-bold text-slate-500">
            {assignments?.filter((a) => a.endDate < todayStr).length ?? 0}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setFilterType('all')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            filterType === 'all'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Assignments ({assignments?.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('upcoming')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            filterType === 'upcoming'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Active & Upcoming ({assignments?.filter((a) => a.endDate >= todayStr).length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setFilterType('past')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            filterType === 'past'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Completed ({assignments?.filter((a) => a.endDate < todayStr).length ?? 0})
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-sm text-slate-500">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent mr-3" />
            Loading assignment records...
          </div>
        ) : filteredAssignments && filteredAssignments.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Vehicle</th>
                  <th className="px-4 py-3.5">Assigned Driver</th>
                  <th className="px-4 py-3.5">Booking Reference</th>
                  <th className="px-4 py-3.5">Service Period</th>
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.map((item) => {
                  const isPast = item.endDate < todayStr;
                  const isCurrent = item.startDate <= todayStr && item.endDate >= todayStr;

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-4 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{item.vehicleName}</div>
                        <div className="text-xs font-mono text-slate-400">ID: {item.vehicleId.slice(0, 8)}...</div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{item.driverName}</div>
                        <div className="text-xs text-slate-500">{item.driverContact || 'No contact'}</div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100 inline-block">
                          {item.bookingId}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                        <span className="font-medium text-slate-900">{item.startDate}</span>
                        <span className="mx-1.5 text-slate-400">to</span>
                        <span className="font-medium text-slate-900">{item.endDate}</span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            On Tour Today
                          </span>
                        ) : isPast ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
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
            <p className="text-sm font-medium text-slate-500">No vehicle assignments found.</p>
            <p className="mt-1 text-xs text-slate-400">
              When vehicles are reserved for bookings, their active schedules will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
