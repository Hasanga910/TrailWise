import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { HomeFooter } from '../home/HomeFooter';
import { HomeNav } from '../home/HomeNav';
import { PageSkeleton } from '../ui/Skeleton';

/** Shared chrome for the logged-out site: nav, page outlet, footer. */
export function PublicLayout() {
  return (
    <div className="min-h-svh bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-fg focus:shadow-raised"
      >
        Skip to content
      </a>
      <HomeNav />
      <main id="main">
        <Suspense
          fallback={
            // Tall enough to keep the footer below the fold, so it doesn't jump when the page chunk arrives.
            <div className="mx-auto min-h-svh max-w-6xl px-4 py-10">
              <PageSkeleton />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <HomeFooter />
    </div>
  );
}
