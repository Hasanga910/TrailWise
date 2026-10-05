import { useCallback, useEffect, useMemo, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  getGuideAvailability,
  getGuides,
  updateGuideAvailability,
  type GuideAvailabilityDto,
  type GuideDto,
} from '../../api/guides';
import { useAuth } from '../../auth/AuthContext';
import { AvailabilityCalendar, type CalendarDay } from '../../components/guides/AvailabilityCalendar';
import { Badge, Button, Card, Select } from '../../components/ui';
import { notify } from '../../components/ui/notify';
import { Loader2 } from 'lucide-react';

function formatDate(year: number, monthIndex: number, day: number): string {
  const y = String(year);
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function GuideAvailabilityPage() {
  const { user } = useAuth();
  const isTourGuide = user?.role === 'TourGuide';

  const [guides, setGuides] = useState<GuideDto[]>([]);
  const [selectedGuideId, setSelectedGuideId] = useState<string>('');
  const [loadingGuides, setLoadingGuides] = useState(true);
  const [guidesError, setGuidesError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const [availabilities, setAvailabilities] = useState<GuideAvailabilityDto[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [togglingDate, setTogglingDate] = useState<string | null>(null);

  // Load guides
  const fetchGuides = useCallback(async () => {
    try {
      const data = await getGuides();
      setGuides(data);

      if (isTourGuide) {
        const myGuide = data.find((g) => g.userId === user?.id);
        if (myGuide) {
          setSelectedGuideId(myGuide.id);
        } else {
          setSelectedGuideId('');
        }
      } else {
        if (data.length > 0) {
          setSelectedGuideId((prev) => (prev && data.some((g) => g.id === prev) ? prev : data[0].id));
        }
      }
    } catch (err) {
      setGuidesError(extractErrorMessage(err, 'Failed to load guides.'));
    } finally {
      setLoadingGuides(false);
    }
  }, [isTourGuide, user?.id]);

  useEffect(() => {
    let cancelled = false;
    getGuides()
      .then((data) => {
        if (cancelled) return;
        setGuides(data);
        if (isTourGuide) {
          const myGuide = data.find((g) => g.userId === user?.id);
          setSelectedGuideId(myGuide ? myGuide.id : '');
        } else if (data.length > 0) {
          setSelectedGuideId((prev) => (prev && data.some((g) => g.id === prev) ? prev : data[0].id));
        }
      })
      .catch((err) => {
        if (!cancelled) setGuidesError(extractErrorMessage(err, 'Failed to load guides.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingGuides(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isTourGuide, user?.id]);

  // Load availability when selectedGuideId or month/year changes
  const fetchAvailability = useCallback(async () => {
    if (!selectedGuideId) {
      setAvailabilities([]);
      return;
    }

    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const from = formatDate(currentYear, currentMonth, 1);
    const to = formatDate(currentYear, currentMonth, lastDayOfMonth);

    setLoadingAvailability(true);
    setAvailabilityError(null);

    try {
      const data = await getGuideAvailability(selectedGuideId, from, to);
      setAvailabilities(data);
    } catch (err) {
      setAvailabilityError(extractErrorMessage(err, 'Failed to load availability.'));
    } finally {
      setLoadingAvailability(false);
    }
  }, [selectedGuideId, currentYear, currentMonth]);

  useEffect(() => {
    if (!selectedGuideId) {
      return;
    }

    let cancelled = false;
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const from = formatDate(currentYear, currentMonth, 1);
    const to = formatDate(currentYear, currentMonth, lastDayOfMonth);

    getGuideAvailability(selectedGuideId, from, to)
      .then((data) => {
        if (!cancelled) setAvailabilities(data);
      })
      .catch((err) => {
        if (!cancelled) setAvailabilityError(extractErrorMessage(err, 'Failed to load availability.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGuideId, currentYear, currentMonth]);

  function handlePrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  // Lookup map for availability
  const availabilityMap = useMemo(() => {
    const map = new Map<string, GuideAvailabilityDto>();
    for (const item of availabilities) {
      map.set(item.date, item);
    }
    return map;
  }, [availabilities]);

  // Calendar dates calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

    const days: CalendarDay[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(currentYear, currentMonth, day);
      const record = availabilityMap.get(dateStr);

      let status: 'available' | 'unavailable' | 'booked' = 'available';
      if (record?.assignedBookingId) {
        status = 'booked';
      } else if (record && record.isAvailable === false) {
        status = 'unavailable';
      }

      days.push({
        dateStr,
        dayNum: day,
        status,
        bookingId: record?.assignedBookingId,
      });
    }

    return { firstDayOfWeek, days };
  }, [currentYear, currentMonth, availabilityMap]);

  async function handleDayClick(dayItem: CalendarDay) {
    if (!isTourGuide) {
      return;
    }

    if (dayItem.status === 'booked') {
      notify.info(`Date ${dayItem.dateStr} is booked and cannot be changed.`);
      return;
    }

    const newIsAvailable = dayItem.status !== 'available';
    setTogglingDate(dayItem.dateStr);
    setAvailabilityError(null);

    try {
      await updateGuideAvailability(selectedGuideId, {
        dates: [{ date: dayItem.dateStr, isAvailable: newIsAvailable }],
      });

      // Update local state immediately
      setAvailabilities((prev) => {
        const existingIdx = prev.findIndex((a) => a.date === dayItem.dateStr);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = {
            ...next[existingIdx],
            isAvailable: newIsAvailable,
          };
          return next;
        } else {
          return [
            ...prev,
            {
              id: `temp-${dayItem.dateStr}`,
              guideId: selectedGuideId,
              date: dayItem.dateStr,
              isAvailable: newIsAvailable,
              assignedBookingId: null,
            },
          ];
        }
      });
    } catch (err) {
      setAvailabilityError(extractErrorMessage(err, 'Failed to update date availability.'));
    } finally {
      setTogglingDate(null);
    }
  }

  const selectedGuide = guides.find((g) => g.id === selectedGuideId);

  return (
    <div className="mx-auto max-w-5xl">
      {loadingGuides && (
        <div className="flex items-center justify-center py-20 text-fg-muted" data-testid="loading-guides">
          <Loader2 className="h-6 w-6 animate-spin text-brand-text" aria-hidden />
          <span className="ml-3 text-body font-medium">Loading guide profiles...</span>
        </div>
      )}

      {!loadingGuides && guidesError && (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-danger-fg">
          <p className="text-body font-semibold">Error Loading Guides</p>
          <p className="mt-1 text-caption">{guidesError}</p>
          <Button variant="danger" size="sm" className="mt-3" onClick={fetchGuides}>
            Try Again
          </Button>
        </div>
      )}

      {!loadingGuides && !guidesError && isTourGuide && !selectedGuide && (
        <div
          className="rounded-card border border-warning/30 bg-warning-soft p-8 text-center"
          data-testid="no-linked-guide-error"
        >
          <h2 className="font-heading text-h4 text-warning-fg">No Guide Profile Linked</h2>
          <p className="mx-auto mt-2 max-w-md text-body text-warning-fg">
            Your user account ({user?.email}) is not linked to any Guide profile in the system. Please contact an
            Operations Manager or Administrator to link your profile.
          </p>
        </div>
      )}

      {!loadingGuides && !guidesError && !isTourGuide && guides.length === 0 && (
        <Card className="p-8 text-center">
          <h2 className="font-heading text-h4 text-fg">No Guides Found</h2>
          <p className="mx-auto mt-2 max-w-md text-body text-fg-muted">
            There are no guide profiles registered in the system yet.
          </p>
        </Card>
      )}

      {!loadingGuides && !guidesError && selectedGuideId && (
        <div className="space-y-6">
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-caption font-semibold uppercase tracking-wider text-fg-muted">
                {isTourGuide ? 'Your Guide Profile' : 'Select Guide'}
              </span>
              {isTourGuide ? (
                <div className="mt-1">
                  <h2 className="font-heading text-h3 text-fg">{selectedGuide?.name}</h2>
                  <p className="text-caption text-fg-muted">
                    Languages: {selectedGuide?.languages?.join(', ') || 'Not specified'} • Specializations:{' '}
                    {selectedGuide?.specializations?.join(', ') || 'Not specified'}
                  </p>
                </div>
              ) : (
                <div className="mt-2 max-w-xs">
                  <Select
                    id="guide-select"
                    data-testid="guide-select"
                    label="Select Guide"
                    value={selectedGuideId}
                    onChange={(e) => setSelectedGuideId(e.target.value)}
                    className="font-medium"
                  >
                    {guides.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <div className="text-left sm:text-right">
              <Badge tone={isTourGuide ? 'success' : 'neutral'}>
                {isTourGuide ? 'Editable Mode' : 'Read-Only Mode'}
              </Badge>
              <p className="mt-1 text-caption text-fg-muted">
                {isTourGuide ? 'Click any date to toggle Available / Unavailable' : 'Operations & Fleet review mode'}
              </p>
            </div>
          </Card>

          {availabilityError && (
            <div
              role="alert"
              className="flex items-center justify-between rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body text-danger-fg"
            >
              <span>{availabilityError}</span>
              <Button variant="ghost" size="sm" className="ml-3 text-danger-fg underline" onClick={fetchAvailability}>
                Retry
              </Button>
            </div>
          )}

          <AvailabilityCalendar
            year={currentYear}
            month={currentMonth}
            firstDayOfWeek={calendarDays.firstDayOfWeek}
            days={calendarDays.days}
            isTourGuide={isTourGuide}
            loading={loadingAvailability}
            togglingDate={togglingDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onDayClick={handleDayClick}
          />
        </div>
      )}
    </div>
  );
}
