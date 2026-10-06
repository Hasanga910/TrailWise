import { Compass, ShieldCheck, Star, WalletCards } from 'lucide-react';

const REASONS = [
  {
    title: 'Handpicked Sri Lankan tours',
    description: 'Culture, coast, wildlife and hill country, with clear routes, classes and what is included.',
    Icon: Compass,
  },
  {
    title: 'Clear prices up front',
    description: 'See the price per person for every class before you sign up, with group offers shown on the tour.',
    Icon: WalletCards,
  },
  {
    title: 'Confirmed by real people',
    description: 'We line up your guide and vehicle and check your booking before you pay a thing.',
    Icon: ShieldCheck,
  },
  {
    title: 'Reviews you can trust',
    description: 'Only travelers who actually finished a tour can review it.',
    Icon: Star,
  },
];

export function WhyTrailWise() {
  return (
    <section aria-labelledby="why-heading" className="bg-surface-sunken py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 id="why-heading" className="max-w-xl font-heading text-h1 text-fg">
          Why travelers choose TrailWise
        </h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map(({ title, description, Icon }) => (
            <li key={title} className="rounded-card border border-border bg-surface-raised p-6 shadow-soft">
              <span className="flex h-11 w-11 items-center justify-center rounded-input bg-brand-soft text-brand-text">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-heading text-h4 text-fg">{title}</h3>
              <p className="mt-2 text-body text-fg-muted">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
