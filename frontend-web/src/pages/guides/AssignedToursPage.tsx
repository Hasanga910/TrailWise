import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getMyAssignedTours, type AssignedTourDto } from '../../api/assignedTours';
import type { BookingStatus } from '../../api/bookings';

const STATUS_STYLES: Record<BookingStatus, string> = {
  Requested: 'bg-neutral-soft text-fg-muted',
  PlanProposed: 'bg-accent-500/15 text-warning-fg',
  PendingApproval: 'bg-warning-soft text-warning-fg',
  Confirmed: 'bg-brand-soft text-brand-text',
  Completed: 'bg-success-soft text-success-fg',
  Cancelled: 'bg-danger-soft text-danger-fg',
  NeedsManualReview: 'bg-danger-soft text-danger-fg',
};

const LIFECYCLE_STYLES = {
  Completed: 'bg-success-soft text-success-fg border border-success/30',
  'In Progress': 'bg-warning-soft text-warning-fg border border-warning/30',
  'Not Started': 'bg-neutral-soft text-fg-muted border border-border',
};

function getLifecycle(tour: AssignedTourDto): 'Completed' | 'In Progress' | 'Not Started' {
  if (tour.tourEndedAt || tour.completed) return 'Completed';
  if (tour.tourStartedAt) return 'In Progress';
  return 'Not Started';
}

export function AssignedToursPage() {
  
  const [tours, setTours] = useState<AssignedTourDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    getMyAssignedTours()
      .then((data) => {
        setTours(data);
        setError(null);
      })
      .catch((err) => setError(extractErrorMessage(err, 'Could not load your assigned tours.')));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
        {error && (
          <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-danger-fg">
            <p className="text-sm font-semibold">Error Loading Tours</p>
            <p className="mt-1 text-xs">{error}</p>
            <button
              onClick={load}
              className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {!error && tours === null && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-surface-raised" />
            ))}
          </div>
        )}

        {!error && tours !== null && tours.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
            <p className="font-medium text-fg-muted">No tours assigned yet.</p>
          </div>
        )}

        {!error && tours !== null && tours.length > 0 && (
          <div className="space-y-3">
            {tours.map((tour) => {
              const lifecycle = getLifecycle(tour);
              return (
                <Link
                  key={tour.bookingId}
                  to={`/guides/my-tours/${tour.bookingId}`}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-surface-raised p-4 shadow-sm transition hover:border-brand-500/30 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-fg">
                      {tour.tourPackageName} — {tour.theme}
                    </p>
                    <p className="mt-0.5 text-sm text-fg-muted">
                      {tour.startDate} to {tour.endDate} · {tour.groupSize} traveler{tour.groupSize === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tour.attended && (
                      <span className="whitespace-nowrap rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-fg">
                        Attended
                      </span>
                    )}
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${LIFECYCLE_STYLES[lifecycle]}`}
                    >
                      {lifecycle}
                    </span>
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[tour.status]}`}
                    >
                      {tour.status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
  );
}
