import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getHomeRouteForRole } from '../../auth/roleHome';
import { Logo } from '../Logo';

const ctaClass =
  'rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-950 transition hover:bg-accent-400';

export function HomeNav() {
  const { status, user } = useAuth();
  const isAuthenticated = status === 'authenticated';

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-brand-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-6">
          <Link to="/" aria-label="TrailWise home">
            <Logo onDark className="h-8 w-auto" />
          </Link>
          <nav aria-label="Main" className="hidden sm:block">
            <NavLink
              to="/explore"
              className={({ isActive }) =>
                `text-sm font-semibold transition hover:text-white ${isActive ? 'text-white' : 'text-white/75'}`
              }
            >
              Explore tours
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/explore" className="text-sm font-semibold text-white/85 transition hover:text-white sm:hidden">
            Explore
          </Link>
          {isAuthenticated && user ? (
            <Link to={getHomeRouteForRole(user.role)} className={ctaClass}>
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-semibold text-white/85 transition hover:text-white">
                Log in
              </Link>
              <Link to="/register" className={ctaClass}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
