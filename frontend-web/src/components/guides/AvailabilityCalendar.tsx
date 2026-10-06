import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Card, IconButton } from '../ui';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type DayStatus = 'available' | 'unavailable' | 'booked';

export interface CalendarDay {
  dateStr: string;
  dayNum: number;
  status: DayStatus;
  bookingId?: string | null;
}

const DAY_STYLES: Record<DayStatus, { cell: string; badge: string; number: string; label: string }> = {
  available: {
    cell: 'bg-success-soft/80 border-success/30 text-success-fg',
    badge: 'bg-success-soft text-success-fg border-success/30',
    number: 'text-success-fg',
    label: 'Available',
  },
  booked: {
    cell: 'bg-info-soft/80 border-info/30 text-info-fg',
    badge: 'bg-info-soft text-info-fg border-info/30',
    number: 'text-info-fg',
    label: 'Booked',
  },
  unavailable: {
    cell: 'bg-neutral-soft/90 border-border text-fg-muted',
    badge: 'bg-neutral-soft text-fg border-border',
    number: 'text-fg-muted',
    label: 'Unavailable',
  },
};

interface AvailabilityCalendarProps {
  year: number;
  month: number;
  firstDayOfWeek: number;
  days: CalendarDay[];
  isTourGuide: boolean;
  loading: boolean;
  togglingDate: string | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayClick: (day: CalendarDay) => void;
}

/** Month grid for a guide's availability. Presentational: the page owns loading and toggling. */
export function AvailabilityCalendar({
  year,
  month,
  firstDayOfWeek,
  days,
  isTourGuide,
  loading,
  togglingDate,
  onPrevMonth,
  onNextMonth,
  onDayClick,
}: AvailabilityCalendarProps) {
  return (
    <Card className="sm:p-6">
      <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-h3 text-fg" data-testid="month-title">
            {MONTH_NAMES[month]} {year}
          </h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-brand-text" aria-hidden />}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 text-caption font-medium text-fg-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-success/30 bg-success" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-border bg-fg-muted" />
              Unavailable
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-info/30 bg-info" />
              Booked
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-input border border-border bg-surface-sunken p-1">
            <IconButton
              label="Previous month"
              size="sm"
              data-testid="prev-month-button"
              icon={<ChevronLeft className="h-4 w-4" aria-hidden />}
              onClick={onPrevMonth}
            />
            <IconButton
              label="Next month"
              size="sm"
              data-testid="next-month-button"
              icon={<ChevronRight className="h-4 w-4" aria-hidden />}
              onClick={onNextMonth}
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-surface-sunken text-center text-caption font-semibold text-fg-muted">
          {WEEKDAY_NAMES.map((w) => (
            <div key={w} className="py-2.5">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-border bg-neutral-soft text-body">
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="min-h-24 bg-surface-sunken/60 p-2 sm:min-h-28" />
          ))}

          {days.map((dayItem) => {
            const isBooked = dayItem.status === 'booked';
            const isToggling = togglingDate === dayItem.dateStr;
            const style = DAY_STYLES[dayItem.status];

            return (
              <button
                key={dayItem.dateStr}
                type="button"
                data-testid={`day-${dayItem.dateStr}`}
                data-status={dayItem.status}
                data-date={dayItem.dateStr}
                onClick={() => onDayClick(dayItem)}
                disabled={!isTourGuide || isToggling}
                aria-label={`${MONTH_NAMES[month]} ${dayItem.dayNum}, ${year}: ${style.label}`}
                className={`group relative flex min-h-24 flex-col justify-between p-2 text-left transition sm:min-h-28 sm:p-2.5 ${style.cell} ${
                  isTourGuide && !isBooked
                    ? 'cursor-pointer hover:ring-2 hover:ring-brand-500/50'
                    : isTourGuide && isBooked
                      ? 'cursor-not-allowed opacity-90'
                      : 'cursor-default'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-heading text-body font-bold ${style.number}`}>{dayItem.dayNum}</span>
                  {isToggling && <Loader2 className="h-3 w-3 animate-spin text-brand-text" aria-hidden />}
                </div>

                <div className="mt-2">
                  <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold sm:text-caption ${style.badge}`}>
                    {style.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-col justify-between gap-2 border-t border-border pt-4 text-caption text-fg-muted sm:flex-row">
        <p>
          * Days without explicit availability records are treated as <strong>Available</strong> by default.
        </p>
        {isTourGuide && <p>Click to toggle. Booked tours are locked to prevent scheduling conflicts.</p>}
      </div>
    </Card>
  );
}
