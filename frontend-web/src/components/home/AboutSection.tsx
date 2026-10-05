import { useInView } from '../../hooks/useInView';

const points = [
  {
    title: 'For travelers',
    description: 'Browse packages and request a trip in minutes, no back-and-forth calls or emails required.',
  },
  {
    title: 'For operators',
    description: 'One console replaces spreadsheets, phone calls, and disconnected messaging for guides and fleet.',
  },
  {
    title: 'For everyone',
    description: 'The busywork runs itself; people only step in when a real decision actually needs a human.',
  },
];

export function AboutSection() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="bg-surface-sunken py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-2xl font-bold text-fg sm:text-3xl">
            Built to be simple, not just powerful
          </h2>
          <p className="mt-3 text-fg-muted">
            TrailWise handles the coordination in the background so travelers and operators can focus on the trip,
            not the process.
          </p>
        </div>

        <div
          ref={ref}
          className={`mt-12 grid gap-6 transition-all duration-700 sm:grid-cols-3 motion-reduce:transition-none ${
            inView ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          {points.map((point) => (
            <div key={point.title} className="rounded-xl border border-border bg-surface-raised p-6 shadow-sm">
              <h3 className="font-heading text-lg font-bold text-fg">{point.title}</h3>
              <p className="mt-1.5 text-sm text-fg-muted">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
