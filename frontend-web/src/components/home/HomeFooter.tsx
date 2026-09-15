import { Logo } from '../Logo';

export function HomeFooter() {
  return (
    <footer className="bg-brand-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo onDark className="h-8 w-auto" />
            <p className="mt-4 max-w-xs text-sm text-white/70">
              One console for operations, guides, and travelers — bringing tour packages,
              bookings, and multi-role coordination together in one place.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Contact us</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href="mailto:support@trailwise.com"
                  className="flex items-center gap-2 text-sm text-white/75 transition hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0">
                    <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 6 8-6" />
                  </svg>
                  support@trailwise.com
                </a>
              </li>
              <li>
                <a
                  href="tel:+10000000000"
                  className="flex items-center gap-2 text-sm text-white/75 transition hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 4h3.2l1.3 4.2-2 1.6a12 12 0 0 0 5.2 5.2l1.6-2 4.2 1.3v3.2c0 1-.9 1.7-1.8 1.5-3.6-.7-7-2.5-9.6-5.1-2.6-2.6-4.4-6-5.1-9.6C2.8 4.9 3.5 4 4.5 4Z"
                    />
                  </svg>
                  +1 (000) 000-0000
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-white/50 sm:text-left">
          &copy; {new Date().getFullYear()} TrailWise. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
