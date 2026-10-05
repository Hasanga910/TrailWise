import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Minus, Plus, Search, Users } from 'lucide-react';
import { IconButton } from '../ui/IconButton';

const MAX_GUESTS = 50;

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Where to? When? How many?" Sends the visitor to the explorer with those choices as URL filters. */
export function HeroSearchBar() {
  const navigate = useNavigate();
  const [where, setWhere] = useState('');
  const [when, setWhen] = useState('');
  const [guests, setGuests] = useState(2);

  function submit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (where.trim()) params.set('q', where.trim());
    if (when) params.set('start', when);
    params.set('guests', String(guests));
    navigate(`/explore?${params.toString()}`);
  }

  const fieldLabel = 'mb-1 flex items-center gap-1.5 text-caption font-semibold text-fg-muted';
  const fieldInput =
    'w-full rounded-input border border-border bg-surface-raised px-3 py-2.5 text-body text-fg placeholder:text-fg-muted/70 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30';

  return (
    <form
      onSubmit={submit}
      aria-label="Find a tour"
      className="grid gap-3 rounded-card bg-surface-raised/95 p-4 text-left shadow-overlay backdrop-blur sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end"
    >
      <div>
        <label htmlFor="hero-where" className={fieldLabel}>
          <Search className="h-3.5 w-3.5" aria-hidden /> Where to?
        </label>
        <input
          id="hero-where"
          type="text"
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          placeholder="Ella, beaches, culture…"
          autoComplete="off"
          className={fieldInput}
        />
      </div>

      <div>
        <label htmlFor="hero-when" className={fieldLabel}>
          <CalendarDays className="h-3.5 w-3.5" aria-hidden /> When?
        </label>
        <input id="hero-when" type="date" min={todayIso()} value={when} onChange={(e) => setWhen(e.target.value)} className={fieldInput} />
      </div>

      <div>
        <span id="hero-how-many" className={fieldLabel}>
          <Users className="h-3.5 w-3.5" aria-hidden /> How many?
        </span>
        <div role="group" aria-labelledby="hero-how-many" className="flex items-center justify-between rounded-input border border-border bg-surface-raised px-1.5 py-1">
          <IconButton
            label="Fewer travelers"
            size="sm"
            icon={<Minus className="h-4 w-4" />}
            disabled={guests <= 1}
            onClick={() => setGuests((g) => Math.max(1, g - 1))}
          />
          <output aria-live="polite" className="text-body font-semibold text-fg">
            {guests} {guests === 1 ? 'traveler' : 'travelers'}
          </output>
          <IconButton
            label="More travelers"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            disabled={guests >= MAX_GUESTS}
            onClick={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))}
          />
        </div>
      </div>

      <button
        type="submit"
        className="inline-flex h-[2.875rem] items-center justify-center gap-2 rounded-input bg-accent-500 px-6 font-semibold text-brand-950 transition hover:bg-accent-400 sm:col-span-2 lg:col-span-1"
      >
        <Search className="h-4 w-4" aria-hidden /> Find tours
      </button>
    </form>
  );
}
