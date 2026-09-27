import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';

export function PortalFallbackPage() {
  const { user, logout } = useAuth();
  const isTourGuide = user?.role === 'TourGuide';
  const canAccessAvailability =
    user?.role === 'TourGuide' ||
    user?.role === 'OperationsManager' ||
    user?.role === 'FleetCoordinator' ||
    user?.role === 'Admin';

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <Logo className="mb-6 h-8 w-auto" />
      <h1 className="font-heading text-xl font-bold text-slate-900">Welcome, {user?.name}</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Access your staff portal features below.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {isTourGuide && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Tours</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              View your assigned tours and record notes
            </p>
            <Link
              to="/guide/tours"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700"
            >
              Open Assigned Tours
            </Link>
          </div>
        )}

        {canAccessAvailability && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Availability</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {isTourGuide ? 'Manage your availability calendar' : 'Review guide schedules'}
            </p>
            <Link
              to="/guides/availability"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700"
            >
              Open Guide Availability
            </Link>
          </div>
        )}
      </div>

      <button
        onClick={logout}
        className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        Log out
      </button>
    </div>
  );
}
