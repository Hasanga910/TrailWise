import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getAssignedTours, type AssignedTourDto } from '../../api/guides';

const STATUS_STYLES: Record<string, string> = {
  Requested: 'bg-slate-100 text-slate-700',
  PlanProposed: 'bg-accent-50 text-accent-700',
  PendingApproval: 'bg-amber-50 text-amber-700',
  Confirmed: 'bg-brand-50 text-brand-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
  NeedsManualReview: 'bg-red-50 text-red-700',
};

export function AssignedToursPage() {
  const [tours, setTours] = useState<AssignedTourDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchTours() {
    setLoading(true);
    setError(null);
    getAssignedTours()
      .then((data) => {
        setTours(data);
      })
      .catch((err) => {
        setError(extractErrorMessage(err, 'Failed to load assigned tours.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchTours();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900">My Assigned Tours</h2>
          <p className="mt-1 text-sm text-slate-500">
            View upcoming and active tours assigned to you, track attendance, and record guide notes.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchTours}
          disabled={loading}
          className="self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading && (
        <div className="flex min-h-60 items-center justify-center rounded-xl border border-slate-200 bg-white p-8">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
              aria-hidden="true"
            />
            <span>Loading assigned tours...</span>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Unable to load tours</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={fetchTours}
            className="mt-3 inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && tours.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="font-semibold text-slate-800">No assigned tours found</p>
          <p className="mt-1 text-sm text-slate-500">
            You currently have no tour bookings assigned to your guide profile.
          </p>
        </div>
      )}

      {!loading && !error && tours.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {tours.map((tour) => {
            const statusClass = STATUS_STYLES[tour.status] ?? 'bg-slate-100 text-slate-700';
            return (
              <div
                key={tour.bookingId}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-base font-bold text-slate-900">
                        {tour.tourPackageName}
                      </h3>
                      <p className="text-xs font-medium text-slate-500">{tour.theme}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}
                    >
                      {tour.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs font-medium text-slate-400">Dates</span>
                      <p className="font-medium text-slate-700">
                        {tour.startDate} to {tour.endDate}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-400">Group Size</span>
                      <p className="font-medium text-slate-700">
                        {tour.groupSize} {tour.groupSize === 1 ? 'traveler' : 'travelers'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-slate-400">Locations</span>
                    <p className="mt-0.5 text-sm text-slate-700">
                      {tour.locations.length > 0 ? tour.locations.join(', ') : 'None listed'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium ${
                        tour.attended
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {tour.attended ? '✓ Attended' : '○ Not Attended'}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium ${
                        tour.completed
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {tour.completed ? '✓ Completed' : '○ Pending Completion'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                  <Link
                    to={`/guide/tours/${tour.bookingId}/itinerary`}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    View Itinerary
                  </Link>
                  <Link
                    to={`/guide/tours/${tour.bookingId}`}
                    className="inline-flex items-center rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-700"
                  >
                    Manage Tour
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
