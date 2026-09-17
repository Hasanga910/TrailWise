import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getHomeRouteForRole } from '../auth/roleHome';
import { AboutSection } from '../components/home/AboutSection';
import { FeatureHighlights } from '../components/home/FeatureHighlights';
import { HeroSlideshow } from '../components/home/HeroSlideshow';
import { HomeFooter } from '../components/home/HomeFooter';
import { HomeNav } from '../components/home/HomeNav';

export function HomePage() {
  const { status, user } = useAuth();
  const isAuthenticated = status === 'authenticated';

  return (
    <div className="min-h-svh bg-white">
      <HomeNav />

      <section className="relative flex h-[80vh] min-h-[560px] max-h-[900px] items-center justify-center overflow-hidden">
        <HeroSlideshow />

        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.45)]">
          <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
            The operations console for modern tour operators.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-white/85 sm:text-lg">
            TrailWise brings tour packages, bookings, and multi-role coordination into one place.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {isAuthenticated && user ? (
              <Link
                to={getHomeRouteForRole(user.role)}
                className="rounded-lg bg-accent-500 px-6 py-3 font-semibold text-brand-950 shadow-lg shadow-black/20 transition hover:bg-accent-400"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="rounded-lg bg-accent-500 px-6 py-3 font-semibold text-brand-950 shadow-lg shadow-black/20 transition hover:bg-accent-400"
                >
                  Get started
                </Link>
                <Link
                  to="/login"
                  className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <FeatureHighlights />
      <AboutSection />
      <HomeFooter />
    </div>
  );
}
