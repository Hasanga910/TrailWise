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
    title: 'Role-based operations',
    description: 'Operations Managers, Fleet Coordinators, Tour Guides, and Admins each get the right view.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="8" r="3" strokeLinecap="round" strokeLinejoin="round" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 8a3 3 0 1 1 3 3M16.5 14.2c2 .5 3.5 2.6 3.5 5.3"
        />
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
];

export function FeatureHighlights() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
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
