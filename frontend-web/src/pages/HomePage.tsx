import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getHomeRouteForRole } from '../auth/roleHome';
import { FeaturedCarousel } from '../components/home/FeaturedCarousel';
import { HeroSearchBar } from '../components/home/HeroSearchBar';
import { HeroSlideshow } from '../components/home/HeroSlideshow';
import { HowItPlans } from '../components/home/HowItPlans';
import { Testimonials } from '../components/home/Testimonials';
import { WhyTrailWise } from '../components/home/WhyTrailWise';
import { usePageTitle } from '../hooks/usePageTitle';

export function HomePage() {
  const { status, user } = useAuth();
  usePageTitle('Discover Sri Lanka, your way');

  // CSS entrance (no animation library on the critical path); reduced motion is handled globally in index.css.
  const rise = (delayMs: number) => ({ style: { animationDelay: `${delayMs}ms` } });

  return (
    <>
      <section className="relative flex min-h-[620px] items-center justify-center overflow-hidden py-20">
        <HeroSlideshow />

        <div className="relative z-10 mx-auto w-full max-w-4xl px-4 text-center text-white sm:px-6">
          <h1 {...rise(0)} className="animate-rise font-heading text-4xl font-bold leading-tight [text-shadow:0_2px_16px_rgba(0,0,0,0.45)] sm:text-5xl">
            Discover Sri Lanka, your way.
          </h1>
          <p {...rise(100)} className="animate-rise mx-auto mt-4 max-w-xl text-white/90 [text-shadow:0_2px_12px_rgba(0,0,0,0.45)] sm:text-lg">
            Handpicked tours with a guide and vehicle confirmed for you. Compare classes and prices before you sign up.
          </p>

          <div {...rise(200)} className="animate-rise mt-8">
            <HeroSearchBar />
          </div>

          <p {...rise(300)} className="animate-rise mt-5 text-sm text-white/90">
            <Link to="/explore" className="font-semibold underline underline-offset-4 hover:text-accent-400">
              Browse all tours
            </Link>
            {status === 'authenticated' && user && (
              <>
                {' · '}
                <Link to={getHomeRouteForRole(user.role)} className="font-semibold underline underline-offset-4 hover:text-accent-400">
                  Go to your dashboard
                </Link>
              </>
            )}
          </p>
        </div>
      </section>

      <FeaturedCarousel />
      <WhyTrailWise />
      <HowItPlans />
      <Testimonials />
    </>
  );
}
