import type { ItineraryStepDto } from '../../api/itineraries';

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  return h && m ? `${h}:${m}` : time;
}

export function ItineraryList({ steps }: { steps: ItineraryStepDto[] }) {
  if (steps.length === 0) {
    return <p className="text-sm text-fg-muted">No itinerary has been set for this trip yet.</p>;
  }

  const grouped = new Map<number, ItineraryStepDto[]>();
  for (const step of steps) {
    const list = grouped.get(step.dayNumber) ?? [];
    list.push(step);
    grouped.set(step.dayNumber, list);
  }
  const days = Array.from(grouped.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const daySteps = [...(grouped.get(day) ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
        return (
          <div key={day}>
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Day {day}</p>
            <ul className="mt-1 space-y-1.5">
              {daySteps.map((step) => (
                <li key={step.id} className="flex items-start gap-3 text-sm">
                  <span className="w-12 shrink-0 font-medium text-fg">{formatTime(step.startTime)}</span>
                  <span className="text-fg">
                    {step.activity} <span className="text-fg-muted">— {step.location}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
