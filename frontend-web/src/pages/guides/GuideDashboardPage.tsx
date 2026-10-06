import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Compass,
  PlayCircle,
  Route,
  User,
  type LucideIcon,
} from 'lucide-react';
import { getMyAssignedTours, type AssignedTourDto } from '../../api/assignedTours';
import { getGuideAvailability, getGuides, type GuideAvailabilityDto } from '../../api/guides';
import { useAuth } from '../../auth/AuthContext';
import { buttonClasses, Card, EmptyState, StatusBadge } from '../../components/ui';
import { cn } from '../../components/ui/cn';
import { formatDate } from '../../utils/format';

const CARDS: { to: string; title: string; description: string; icon: LucideIcon }[] = [
  {
    to: '/guides/my-tours',
    title: 'My Assigned Tours',
    description: 'View your upcoming and active tours.',
    icon: Route,
  },
  {
    to: '/guides/availability',
    title: 'Guide Availability',
    description: 'Manage the days you are available for tours.',
    icon: CalendarDays,
  },
  {
    to: '/guides/profile',
    title: 'Profile',
    description: 'Update your guide details, languages, specializations, and password.',
    icon: User,
  },
];

export function isUpcomingOrActiveTour(tour: AssignedTourDto): boolean {
  if (tour.completed || tour.tourEndedAt) return false;
  if (tour.status === 'Completed' || tour.status === 'Cancelled') return false;
  return true;
}

function isInProgress(tour: AssignedTourDto): boolean {
  return isUpcomingOrActiveTour(tour) && !!tour.tourStartedAt;
}

function isCompleted(tour: AssignedTourDto): boolean {
  return tour.completed || !!tour.tourEndedAt || tour.status === 'Completed';
}

function toDateStr(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

type DayStatus = 'available' | 'unavailable' | 'booked';

const DAY_STYLES: Record<DayStatus, { cell: string; label: string }> = {
  available: { cell: 'border-success/30 bg-success-soft text-success-fg', label: 'Available' },
  booked: { cell: 'border-info/30 bg-info-soft text-info-fg', label: 'Assigned' },
  unavailable: { cell: 'border-border bg-neutral-soft text-fg-muted', label: 'Unavailable' },
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Availability {
  availableThisMonth: number;
  week: { dateStr: string; weekday: string; dayNum: number; status: DayStatus }[];
}

function buildAvailability(records: GuideAvailabilityDto[], now: Date): Availability {
  const byDate = new Map(records.map((r) => [r.date, r]));
  const statusOf = (dateStr: string): DayStatus => {
    const record = byDate.get(dateStr);
    if (record?.assignedBookingId) return 'booked';
    if (record && record.isAvailable === false) return 'unavailable';
    return 'available';
  };

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let availableThisMonth = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (statusOf(toDateStr(new Date(now.getFullYear(), now.getMonth(), day))) === 'available') availableThisMonth++;
  }

  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const week = WEEKDAYS.map((weekday, i) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dateStr = toDateStr(date);
    return { dateStr, weekday, dayNum: date.getDate(), status: statusOf(dateStr) };
  });
  return { availableThisMonth, week };
}

export function GuideDashboardPage() {
  const { user } = useAuth();
  const [tours, setTours] = useState<AssignedTourDto[] | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);

  useEffect(() => {
    getMyAssignedTours()
      .then(setTours)
      .catch(() => setTours(null));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
    const from = toDateStr(weekStart < monthStart ? weekStart : monthStart);
    const to = toDateStr(weekEnd > monthEnd ? weekEnd : monthEnd);

    getGuides()
      .then((guides) => {
        const me = guides.find((g) => g.userId === user.id);
        if (!me) return null;
        return getGuideAvailability(me.id, from, to);
      })
      .then((records) => setAvailability(records ? buildAvailability(records, now) : null))
      .catch(() => setAvailability(null));
  }, [user?.id]);

  const guideName = user?.name ?? 'Tour Guide';
  const upcoming = tours?.filter(isUpcomingOrActiveTour) ?? null;
  const upcomingCount = upcoming ? upcoming.length : null;
  const nextTours = upcoming ? [...upcoming].sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 3) : null;

  const stats = [
    upcoming && { label: 'Upcoming tours', value: upcoming.length, icon: CalendarClock, tint: 'bg-brand-soft text-brand-fg' },
    tours && { label: 'In progress', value: tours.filter(isInProgress).length, icon: PlayCircle, tint: 'bg-info-soft text-info-fg' },
    tours && { label: 'Completed', value: tours.filter(isCompleted).length, icon: CheckCircle, tint: 'bg-success-soft text-success-fg' },
    availability && {
      label: 'Available days this month',
      value: availability.availableThisMonth,
      icon: CalendarCheck,
      tint: 'bg-warning-soft text-warning-fg',
    },
  ].filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-950 px-6 py-8 text-white shadow-lg sm:px-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-8 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-accent-300">
            <Compass className="h-3.5 w-3.5" aria-hidden /> Guide Portal
          </span>
          <p className="mt-3 max-w-2xl font-heading text-xl font-bold sm:text-2xl">
            Welcome back, <span>{guideName}</span>.{' '}
            {upcomingCount !== null && `You have ${upcomingCount} upcoming assigned tour${upcomingCount === 1 ? '' : 's'}.`}
          </p>
          <p className="mt-2 max-w-xl text-sm text-white/75">Your tours, schedule and availability at a glance.</p>
          <Link to="/guides/my-tours" className={buttonClasses('primary', 'lg', 'mt-6 w-full sm:w-auto')}>
            View my tours
          </Link>
        </div>
      </section>

      {stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map(({ icon: Icon, ...stat }) => (
            <Card key={stat.label} className="!p-3 sm:!p-4">
              <span className={cn('flex h-9 w-9 items-center justify-center rounded-input', stat.tint)}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <dt className="mt-3 text-caption text-fg-muted">{stat.label}</dt>
              <dd className="mt-1 font-heading text-h3 text-fg">{stat.value}</dd>
            </Card>
          ))}
        </dl>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {nextTours && (
          <Card padded={false} className="lg:col-span-2">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 className="font-heading text-h4 text-fg">Next tours</h2>
              {nextTours.length > 0 && (
                <Link to="/guides/my-tours" className="text-body font-semibold text-brand-text hover:underline">
                  View all
                </Link>
              )}
            </div>
            {nextTours.length === 0 ? (
              <EmptyState
                title="No upcoming tours yet"
                description="Tours assigned to you will show up here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {nextTours.map((tour) => (
                  <li key={tour.bookingId}>
                    <Link
                      to={`/guides/my-tours/${tour.bookingId}`}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-fg">{tour.tourPackageName}</p>
                        <p className="mt-0.5 text-caption text-fg-muted">
                          {formatDate(tour.startDate)} – {formatDate(tour.endDate)} · {tour.groupSize}{' '}
                          {tour.groupSize === 1 ? 'traveler' : 'travelers'}
                        </p>
                      </div>
                      <StatusBadge status={tour.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card padded={false} className={nextTours ? undefined : 'lg:col-span-3'}>
          <h2 className="border-b border-border px-5 py-4 font-heading text-h4 text-fg">Quick links</h2>
          <ul className="divide-y divide-border">
            {CARDS.map(({ icon: Icon, ...card }) => (
              <li key={card.to}>
                <Link
                  to={card.to}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-brand-soft text-brand-fg">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <h2 className="font-semibold text-fg">{card.title}</h2>
                    <p className="truncate text-caption text-fg-muted">{card.description}</p>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {availability && (
        <Link to="/guides/availability" className="block rounded-card" aria-label="This week's availability">
          <Card interactive>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-h4 text-fg">This week's availability</h2>
              <ChevronRight className="h-4 w-4 text-fg-muted" aria-hidden />
            </div>
            <ul className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-3">
              {availability.week.map((day) => (
                <li
                  key={day.dateStr}
                  className={cn('flex flex-col items-center rounded-input border px-1 py-2 text-center', DAY_STYLES[day.status].cell)}
                >
                  <span className="text-caption font-semibold">{day.weekday}</span>
                  <span className="font-heading text-h4">{day.dayNum}</span>
                  <span className="mt-1 hidden text-caption sm:block">{DAY_STYLES[day.status].label}</span>
                  <span className="sr-only sm:hidden">{DAY_STYLES[day.status].label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Link>
      )}
    </div>
  );
}
