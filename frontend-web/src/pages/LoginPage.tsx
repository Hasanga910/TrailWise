import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getHomeRouteForRole } from '../auth/roleHome';
import { AuthBrandPanel } from '../components/AuthBrandPanel';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const { login, status, error, user } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    const defaultRedirect = user ? getHomeRouteForRole(user.role) : '/login';
    const redirectTo = (location.state as { from?: string } | null)?.from ?? defaultRedirect;
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await login(email, password);
    setSubmitting(false);
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <AuthBrandPanel tagline="Plan, book, and run unforgettable tours." />

      <div className="flex min-w-0 items-center justify-center bg-white px-6 py-12">
        <form className="w-full min-w-0 max-w-sm space-y-6" onSubmit={handleSubmit}>
          <div>
            <Logo className="mb-4 h-8 w-auto lg:hidden" />
            <h1 className="font-heading text-2xl font-bold text-slate-900">Login</h1>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to manage your tours.</p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </label>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Logging in...' : 'Log in'}
          </button>

          <p className="text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
