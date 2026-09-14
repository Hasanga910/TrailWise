import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { FeatureHighlights } from '../components/home/FeatureHighlights';
import { HeroSlideshow } from '../components/home/HeroSlideshow';
import { HomeFooter } from '../components/home/HomeFooter';
import { HomeNav } from '../components/home/HomeNav';

export function HomePage() {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  return (
    <div className="min-h-svh bg-white">
      <HomeNav />

      <section className="relative flex min-h-[640px] items-center justify-center overflow-hidden sm:min-h-[720px]">
        <HeroSlideshow />

        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center text-white">
          <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
            The operations console for modern tour operators.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-white/85 sm:text-lg">
            TrailWise brings tour packages, bookings, and multi-role coordination into one place.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
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
      <HomeFooter />
    </div>
  );
}
