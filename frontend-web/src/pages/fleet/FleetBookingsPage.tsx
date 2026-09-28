import { useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { getAllBookings, type BookingDto } from '../../api/bookings';
import { BookingsIcon } from '../../components/admin/icons';

export function FleetBookingsPage() {
  const [bookings, setBookings] = useState<BookingDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function loadBookings() {
    setError(null);
    getAllBookings({ pageSize: 50 })
      .then((res) => setBookings(res.items))
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load bookings.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBookings();
  }, []);

  function handleCopy(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filteredBookings = bookings?.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <BookingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-900">Bookings & Allocation Reference</h1>
            <p className="text-sm text-slate-500">
              Browse booking requests, guest group sizes, travel dates, and copy Booking GUIDs for vehicle allocation.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Bookings</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{bookings?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Confirmed / Requested</p>
          <p className="mt-2 text-2xl font-bold text-brand-600">
            {bookings?.filter((b) => b.status === 'Confirmed' || b.status === 'Requested').length ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Large Groups (&gt; 7 pax)</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {bookings?.filter((b) => b.groupSize > 7).length ?? 0}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {['all', 'Requested', 'PlanProposed', 'Confirmed', 'NeedsManualReview'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              statusFilter === status
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {status === 'all' ? 'All Statuses' : status}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Bookings Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-sm text-slate-500">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent mr-3" />
            Loading booking requests...
          </div>
        ) : filteredBookings && filteredBookings.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Booking GUID</th>
                  <th className="px-4 py-3.5">Package</th>
                  <th className="px-4 py-3.5">Group Size</th>
                  <th className="px-4 py-3.5">Dates</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          {b.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(b.id)}
                          className="rounded px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition"
                        >
                          {copiedId === b.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="font-semibold text-slate-900">{b.tourPackageName || 'Tour Package'}</p>
                      <p className="text-xs text-slate-400">
                        {b.packageTier ? `${b.packageTier.classType} Tier` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                        {b.groupSize} {b.groupSize === 1 ? 'Guest' : 'Guests'}
                      </span>
                      {b.groupSize > 7 && (
                        <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                          Coach Needed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      <span className="font-medium text-slate-900">{b.startDate}</span>
                      <span className="mx-1 text-slate-400">to</span>
                      <span className="font-medium text-slate-900">{b.endDate}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20">
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <a
                        href="/fleet"
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                      >
                        Allocate Vehicle &rarr;
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-500">No bookings found for the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
