import { useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { getMyBookings, type BookingDto, type BookingStatus, type PagedResult } from '../../api/bookings';

const PAGE_SIZE = 10;

const STATUS_OPTIONS: BookingStatus[] = [
  'Requested',
  'PlanProposed',
  'PendingApproval',
  'Confirmed',
  'Completed',
  'Cancelled',
  'NeedsManualReview',
];

const STATUS_STYLES: Record<BookingStatus, string> = {
  Requested: 'bg-slate-100 text-slate-600',
  PlanProposed: 'bg-accent-500/15 text-accent-700',
  PendingApproval: 'bg-amber-50 text-amber-700',
  Confirmed: 'bg-brand-50 text-brand-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
  NeedsManualReview: 'bg-red-50 text-red-700',
};

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const labelClass = 'text-xs font-semibold text-slate-600';

export function MyBookingsPage() {
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<PagedResult<BookingDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      getMyBookings({
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
        .then((data) => {
          setResult(data);
          setError(null);
        })
        .catch((err) => setError(extractErrorMessage(err, 'Could not load your bookings.')))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [status, from, to, page]);

  function handleStatusChange(value: string) {
    setStatus(value as BookingStatus | '');
    setPage(1);
  }

  function handleFromChange(value: string) {
    setFrom(value);
    setPage(1);
  }

  function handleToChange(value: string) {
    setTo(value);
    setPage(1);
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.totalCount / result.pageSize)) : 1;
  const isFirstPage = page <= 1;
  const isLastPage = result ? page * result.pageSize >= result.totalCount : true;

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-heading text-xl font-bold text-slate-900">My Bookings</h2>
        <p className="mt-1 text-sm text-slate-500">Track the status of your booking requests.</p>
      </div>

      <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="statusFilter" className={labelClass}>
            Status
          </label>
          <select
            id="statusFilter"
            className={inputClass}
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fromFilter" className={labelClass}>
            From
          </label>
          <input
            id="fromFilter"
            type="date"
            className={inputClass}
            value={from}
            onChange={(e) => handleFromChange(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="toFilter" className={labelClass}>
            To
          </label>
          <input
            id="toFilter"
            type="date"
            className={inputClass}
            value={to}
            onChange={(e) => handleToChange(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!error && loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      )}

      {!error && !loading && result && result.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-600">No bookings match your filters.</p>
        </div>
      )}

      {!error && !loading && result && result.items.length > 0 && (
        <>
          <div className="space-y-3">
            {result.items.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {booking.tourPackageName} — {booking.packageTier.classType}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {booking.startDate} to {booking.endDate} · {booking.groupSize} traveler
                    {booking.groupSize === 1 ? '' : 's'} · ${booking.budgetPerPerson.toFixed(2)}/person budget
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {booking.isLargeGroup && (
                    <span className="whitespace-nowrap rounded-full bg-accent-500/15 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
                      Large group
                    </span>
                  )}
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[booking.status]}`}
                  >
                    {booking.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              disabled={isFirstPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={isLastPage}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
