import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getAllBookings, type BookingStatus, type BookingSummaryDto } from '../../api/bookings';

const STATUS_STYLES: Record<BookingStatus, string> = {
  Requested: 'bg-slate-100 text-slate-600',
  PlanProposed: 'bg-accent-500/15 text-accent-700',
  PendingApproval: 'bg-amber-50 text-amber-700',
  Confirmed: 'bg-brand-50 text-brand-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
  NeedsManualReview: 'bg-red-50 text-red-700',
};

export function OpsBookingsPage() {
  const [bookings, setBookings] = useState<BookingSummaryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllBookings()
      .then((data) => {
        setBookings(data);
        setError(null);
      })
      .catch((err) => setError(extractErrorMessage(err, 'Could not load bookings.')));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-heading text-xl font-bold text-slate-900">Bookings</h2>
        <p className="mt-1 text-sm text-slate-500">All traveler booking requests.</p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!error && bookings === null && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      )}

      {!error && bookings !== null && bookings.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-600">No bookings yet.</p>
        </div>
      )}

      {bookings && bookings.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Traveler</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Start date</th>
                <th className="px-4 py-3">Group size</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((booking) => (
                <tr key={booking.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{booking.travelerName}</td>
                  <td className="px-4 py-3 text-slate-600">{booking.packageName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[booking.status]}`}
                    >
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{booking.createdAt}</td>
                  <td className="px-4 py-3 text-slate-600">{booking.startDate}</td>
                  <td className="px-4 py-3 text-slate-600">{booking.groupSize}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/ops/bookings/${booking.id}/workflow`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      View agent workflow
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
