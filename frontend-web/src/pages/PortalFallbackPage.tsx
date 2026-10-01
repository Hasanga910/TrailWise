import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';

export function PortalFallbackPage() {
  const { user, logout } = useAuth();
  const canAccessAvailability =
    user?.role === 'TourGuide' ||
    user?.role === 'OperationsManager' ||
    user?.role === 'FleetCoordinator';

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <Logo className="mb-6 h-8 w-auto" />
      <h1 className="font-heading text-xl font-bold text-slate-900">Welcome, {user?.name}</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        There isn't a full portal dashboard for the {user?.role} role yet.
      </p>

      {canAccessAvailability && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Available Features</p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {user?.role === 'TourGuide' ? 'Manage your availability calendar' : 'Review guide schedules'}
          </p>
          <Link
            to="/guides/availability"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700"
          >
            Open Guide Availability
          </Link>
          {user?.role === 'TourGuide' && (
            <>
              <Link
                to="/guides/my-tours"
                className="mt-3 ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                View My Assigned Tours
              </Link>
              <Link
                to="/guides/profile"
                className="mt-3 ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Profile & Settings
              </Link>
            </>
          )}
        </div>
      )}

      {user?.role === 'Driver' && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Driver Portal</p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            Access your assigned driving schedule and vehicle specifications.
          </p>
          <Link
            to="/driver/dashboard"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700"
          >
            Go to Driver Dashboard
          </Link>
        </div>
      )}

      <button
        onClick={logout}
        className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        Log out
      </button>
    </div>
  );
}

