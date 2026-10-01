import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getMyAssignedTours, type AssignedTourDto } from '../../api/assignedTours';
import type { BookingStatus } from '../../api/bookings';
import { useAuth } from '../../auth/AuthContext';
import { getHomeRouteForRole } from '../../auth/roleHome';
import { Avatar } from '../../components/Avatar';
import { Logo } from '../../components/Logo';
import { LogoutIcon } from '../../components/admin/icons';

const STATUS_STYLES: Record<BookingStatus, string> = {
  Requested: 'bg-slate-100 text-slate-600',
  PlanProposed: 'bg-accent-500/15 text-accent-700',
  PendingApproval: 'bg-amber-50 text-amber-700',
  Confirmed: 'bg-brand-50 text-brand-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
  NeedsManualReview: 'bg-red-50 text-red-700',
};

const LIFECYCLE_STYLES = {
  Completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'In Progress': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Not Started': 'bg-slate-100 text-slate-600 border border-slate-200',
};

function getLifecycle(tour: AssignedTourDto): 'Completed' | 'In Progress' | 'Not Started' {
  if (tour.tourEndedAt || tour.completed) return 'Completed';
  if (tour.tourStartedAt) return 'In Progress';
  return 'Not Started';
}

export function AssignedToursPage() {
  const { user, logout } = useAuth();
  const homeRoute = user ? getHomeRouteForRole(user.role) : '/login';

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
    <div className="min-h-svh bg-slate-50">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-brand-500 before:via-accent-500 before:to-brand-500">
        <div className="flex items-center gap-4">
          <Link to={homeRoute} title="Home" className="flex items-center gap-2">
            <Logo className="h-7 w-auto" />
          </Link>
          <span className="hidden text-slate-300 sm:inline">|</span>
          <h1 className="font-heading text-lg font-bold text-slate-900">My Assigned Tours</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/guides/my-tours"
            className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 sm:inline-block"
          >
            My Tours
          </Link>
          <Link
            to="/guides/availability"
            className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 sm:inline-block"
          >
            Guide Availability
          </Link>
          <Link
            to="/guides/profile"
            className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 sm:inline-block"
          >
            Profile
          </Link>

          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-700">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.role}</p>
          </div>
          {user && <Avatar name={user.name} size="sm" />}

          <button
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogoutIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
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
              <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {!error && tours !== null && tours.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="font-medium text-slate-600">No tours assigned yet.</p>
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
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {tour.tourPackageName} — {tour.theme}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {tour.startDate} to {tour.endDate} · {tour.groupSize} traveler{tour.groupSize === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tour.attended && (
                      <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
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
      </main>
    </div>
  );
}
