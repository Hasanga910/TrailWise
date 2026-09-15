import { useInView } from '../../hooks/useInView';

const features = [
  {
    title: 'Tour package management',
    description: 'Build packages with themes, durations, group sizes, and multiple pricing tiers.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="7" width="18" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  },
  {
    title: 'Traveler self-service',
    description: 'Travelers register and browse tour packages directly, no back-and-forth required.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21c-4-4.5-7-8.2-7-11.5A7 7 0 0 1 19 9.5C19 12.8 16 16.5 12 21Z"
        />
        <circle cx="12" cy="9.5" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'AI-powered matching & pricing',
    description:
      'An agentic AI workflow matches the right guide and vehicle and calculates tier-aware pricing automatically, only pausing for approval on large-group, budget, or refund exceptions.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
        />
        <circle cx="12" cy="12" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Real-time availability & tracking',
    description:
      'Guide and vehicle availability, pending proposals, and booking status all update live, from the moment a trip is requested through confirmation.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h3l2.5-7 4 14 2.5-7H20" />
      </svg>
    ),
  },
];

export function FeatureHighlights() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 scroll-mt-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-heading text-2xl font-bold text-slate-900 sm:text-3xl">
          Everything your tour operation needs
        </h2>
        <p className="mt-3 text-slate-500">
          One console for packages, bookings, and the whole team behind every trip.
        </p>
      </div>

      <div
        ref={ref}
        className={`mt-12 grid gap-6 transition-all duration-700 sm:grid-cols-2 lg:grid-cols-3 motion-reduce:transition-none ${
          inView ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              {feature.icon}
            </div>
            <h3 className="mt-4 font-heading text-lg font-bold text-slate-900">{feature.title}</h3>
            <p className="mt-1.5 text-sm text-slate-500">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
