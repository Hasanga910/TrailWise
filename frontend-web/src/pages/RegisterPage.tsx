import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getHomeRouteForRole } from '../auth/roleHome';
import { AuthBrandPanel } from '../components/AuthBrandPanel';
import { Logo } from '../components/Logo';

export function RegisterPage() {
  const { register, status, error, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to={user ? getHomeRouteForRole(user.role) : '/login'} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await register(name, email, password, contactNumber);
    setSubmitting(false);
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <AuthBrandPanel tagline="Join the platform built for modern tour operators." />

      <div className="flex min-w-0 items-center justify-center bg-surface-raised px-6 py-12">
        <form className="w-full min-w-0 max-w-sm space-y-6" onSubmit={handleSubmit}>
          <div>
            <Logo className="mb-4 h-8 w-auto lg:hidden" />
            <h1 className="font-heading text-2xl font-bold text-fg">
              Create a Traveler Account
            </h1>
            <p className="mt-1.5 text-sm text-fg-muted">
              Sign up to browse and book tour packages.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-fg">Full name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="block w-full rounded-lg border border-border px-3.5 py-2.5 text-base text-fg outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-fg">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full rounded-lg border border-border px-3.5 py-2.5 text-base text-fg outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-fg">Contact number</span>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                required
                className="block w-full rounded-lg border border-border px-3.5 py-2.5 text-base text-fg outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-fg">Password</span>
              <input
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full rounded-lg border border-border px-3.5 py-2.5 text-base text-fg outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger-fg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating account...' : 'Register'}
          </button>

          <p className="text-sm text-fg-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-text hover:text-brand-text">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
