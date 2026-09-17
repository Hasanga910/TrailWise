import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';

export function PortalFallbackPage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <Logo className="mb-6 h-8 w-auto" />
      <h1 className="font-heading text-xl font-bold text-slate-900">Welcome, {user?.name}</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        There isn't a dashboard for the {user?.role} role yet. Please contact your administrator if
        you believe this is a mistake.
      </p>
      <button
        onClick={logout}
        className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        Log out
      </button>
    </div>
  );
}
