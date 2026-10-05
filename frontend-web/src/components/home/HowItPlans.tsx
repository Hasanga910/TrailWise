const STEPS = [
  {
    title: 'You tell us what you want',
    body: 'Pick a tour and class, then choose your dates and how many are travelling.',
  },
  {
    title: 'We run a smart booking check',
    body: 'Our booking assistant checks that a guide is free, that a vehicle with room for your group is available, and works out your final price, including any group offer.',
  },
  {
    title: 'A person reviews anything unusual',
    body: 'Straightforward bookings move quickly. If something needs a closer look, someone on our team steps in before you hear from us.',
  },
  {
    title: 'You confirm and pay a deposit',
    body: 'Once everything lines up you approve the plan and pay the advance. Your guide and vehicle are then locked in.',
  },
];

export function HowItPlans() {
  return (
    <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 id="how-heading" className="font-heading text-h1 text-fg">
        How TrailWise plans your trip
      </h2>
      <p className="mt-2 max-w-2xl text-body-lg text-fg-muted">
        No back-and-forth emails. Here's what happens after you send a booking request.
      </p>
      <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative rounded-card border border-border bg-surface-raised p-6 shadow-soft">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 font-heading text-body font-bold text-white"
            >
              {i + 1}
            </span>
            <h3 className="mt-4 font-heading text-h4 text-fg">{step.title}</h3>
            <p className="mt-2 text-body text-fg-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
