import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getHomeRouteForRole } from '../../auth/roleHome';
import { Logo } from '../Logo';

export function HomeNav() {
  const { status, user } = useAuth();
  const isAuthenticated = status === 'authenticated';

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-brand-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo onDark className="h-8 w-auto" />

        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <Link
              to={getHomeRouteForRole(user.role)}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-950 transition hover:bg-accent-400"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-semibold text-white/85 transition hover:text-white">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-950 transition hover:bg-accent-400"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
