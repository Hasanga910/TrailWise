import { Logo } from './Logo';

export function AuthBrandPanel({ tagline }: { tagline: string }) {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-950 p-10 text-white lg:flex">
      <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-accent-500/20 blur-3xl" />

      <div className="relative z-10">
        <Logo onDark className="h-8 w-auto" />
      </div>

      <div className="relative z-10 max-w-md">
        <h2 className="font-heading text-3xl font-bold leading-tight">{tagline}</h2>
        <p className="mt-3 text-white/75">
          One console for operations, guides, and travelers.
        </p>

        <div className="mt-10 flex gap-6 text-white/85">
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21c-4-4.5-7-8.2-7-11.5A7 7 0 0 1 19 9.5C19 12.8 16 16.5 12 21Z"
            />
            <circle cx="12" cy="9.5" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m14.5 9.5-1.8 4.7a1 1 0 0 1-.5.5l-4.7 1.8 1.8-4.7a1 1 0 0 1 .5-.5l4.7-1.8Z"
            />
          </svg>
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m3 19 5.5-9 4 6.2L15.5 11 21 19H3Z"
            />
          </svg>
        </div>
      </div>

      <p className="relative z-10 text-sm text-white/60">
        &copy; {new Date().getFullYear()} TrailWise. Built for tour operations.
      </p>
    </div>
  );
}
