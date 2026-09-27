import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import {
  getGuideAvailability,
  getGuides,
  updateGuideAvailability,
  type GuideAvailabilityDto,
  type GuideDto,
} from '../../api/guides';
import { useAuth } from '../../auth/AuthContext';
import { getHomeRouteForRole } from '../../auth/roleHome';
import { Avatar } from '../../components/Avatar';
import { Logo } from '../../components/Logo';
import { ChevronIcon, LogoutIcon } from '../../components/admin/icons';

const MONTH_NAMES = [
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

function formatDate(year: number, monthIndex: number, day: number): string {
  const y = String(year);
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function GuideAvailabilityPage() {
  const { user, logout } = useAuth();
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
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
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
    setInfoMessage(null);

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
    setInfoMessage(null);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    setInfoMessage(null);
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

    const days: { dateStr: string; dayNum: number; status: 'available' | 'unavailable' | 'booked'; bookingId?: string | null }[] = [];

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

  async function handleDayClick(dayItem: {
    dateStr: string;
    dayNum: number;
    status: 'available' | 'unavailable' | 'booked';
  }) {
    if (!isTourGuide) {
      return;
    }

    if (dayItem.status === 'booked') {
      setInfoMessage(`Date ${dayItem.dateStr} is booked and cannot be changed.`);
      return;
    }

    const newIsAvailable = dayItem.status !== 'available';
    setTogglingDate(dayItem.dateStr);
    setAvailabilityError(null);
    setInfoMessage(null);

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
  const homeRoute = user ? getHomeRouteForRole(user.role) : '/login';

  return (
    <div className="min-h-svh bg-slate-50">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-brand-500 before:via-accent-500 before:to-brand-500">
        <div className="flex items-center gap-4">
          <Link to={homeRoute} title="Home" className="flex items-center gap-2">
            <Logo className="h-7 w-auto" />
          </Link>
          <span className="hidden text-slate-300 sm:inline">|</span>
          <h1 className="font-heading text-lg font-bold text-slate-900">Guide Availability</h1>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to={homeRoute}
            className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 sm:inline-block"
          >
            {user?.role === 'OperationsManager' ? 'Ops Dashboard' : 'Dashboard'}
          </Link>

          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-700">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.role}</p>
          </div>
          {user && <Avatar name={user.name} size="sm" />}

          <button
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogoutIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Guides Loading */}
        {loadingGuides && (
          <div className="flex items-center justify-center py-20 text-slate-500" data-testid="loading-guides">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <span className="ml-3 text-sm font-medium">Loading guide profiles...</span>
          </div>
        )}

        {/* Guides Error */}
        {!loadingGuides && guidesError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold text-sm">Error Loading Guides</p>
            <p className="mt-1 text-xs">{guidesError}</p>
            <button
              onClick={fetchGuides}
              className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* TourGuide with no linked profile */}
        {!loadingGuides && !guidesError && isTourGuide && !selectedGuide && (
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"
            data-testid="no-linked-guide-error"
          >
            <h2 className="font-heading text-lg font-bold text-amber-900">No Guide Profile Linked</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-amber-700">
              Your user account ({user?.email}) is not linked to any Guide profile in the system. Please contact an
              Operations Manager or Administrator to link your profile.
            </p>
          </div>
        )}

        {/* No guides in the system (Ops / Fleet) */}
        {!loadingGuides && !guidesError && !isTourGuide && guides.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <h2 className="font-heading text-lg font-bold text-slate-900">No Guides Found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              There are no guide profiles registered in the system yet.
            </p>
          </div>
        )}

        {/* Main Availability View */}
        {!loadingGuides && !guidesError && selectedGuideId && (
          <div className="space-y-6">
            {/* Guide Selector / Profile Banner */}
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {isTourGuide ? 'Your Guide Profile' : 'Select Guide'}
                </span>
                {isTourGuide ? (
                  <div className="mt-1">
                    <h2 className="font-heading text-xl font-bold text-slate-900">{selectedGuide?.name}</h2>
                    <p className="text-xs text-slate-500">
                      Languages: {selectedGuide?.languages?.join(', ') || 'Not specified'} • Specializations:{' '}
                      {selectedGuide?.specializations?.join(', ') || 'Not specified'}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <label htmlFor="guide-select" className="sr-only">
                      Select Guide
                    </label>
                    <select
                      id="guide-select"
                      data-testid="guide-select"
                      value={selectedGuideId}
                      onChange={(e) => setSelectedGuideId(e.target.value)}
                      className="block w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      {guides.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Editing Mode Notice */}
              <div className="text-left sm:text-right">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isTourGuide ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {isTourGuide ? 'Editable Mode' : 'Read-Only Mode'}
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  {isTourGuide
                    ? 'Click any date to toggle Available / Unavailable'
                    : 'Operations & Fleet review mode'}
                </p>
              </div>
            </div>

            {/* Info or Error messages */}
            {infoMessage && (
              <div
                role="status"
                className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
              >
                <span>{infoMessage}</span>
                <button
                  onClick={() => setInfoMessage(null)}
                  className="ml-3 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Dismiss
                </button>
              </div>
            )}

            {availabilityError && (
              <div
                role="alert"
                className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <span>{availabilityError}</span>
                <button
                  onClick={fetchAvailability}
                  className="ml-3 text-xs font-semibold text-red-600 underline hover:text-red-800"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Calendar Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              {/* Calendar Controls & Month Header */}
              <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="font-heading text-xl font-bold text-slate-900" data-testid="month-title">
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </h2>
                  {loadingAvailability && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  )}
                </div>

                {/* Navigation and Legend */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Legend */}
                  <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full border border-emerald-300 bg-emerald-500" />
                      Available
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full border border-slate-300 bg-slate-400" />
                      Unavailable
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full border border-blue-300 bg-blue-500" />
                      Booked
                    </span>
                  </div>

                  {/* Month Switch Buttons */}
                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                    <button
                      onClick={handlePrevMonth}
                      aria-label="Previous month"
                      data-testid="prev-month-button"
                      className="rounded-md p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 hover:shadow-xs"
                    >
                      <ChevronIcon className="h-4 w-4 rotate-90" />
                    </button>
                    <button
                      onClick={handleNextMonth}
                      aria-label="Next month"
                      data-testid="next-month-button"
                      className="rounded-md p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 hover:shadow-xs"
                    >
                      <ChevronIcon className="h-4 w-4 -rotate-90" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                {/* Weekday Header */}
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
                  {WEEKDAY_NAMES.map((w) => (
                    <div key={w} className="py-2.5">
                      {w}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-100 text-sm">
                  {/* Empty cells before month starts */}
                  {Array.from({ length: calendarDays.firstDayOfWeek }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="min-h-24 bg-slate-50/60 p-2 sm:min-h-28" />
                  ))}

                  {/* Month days */}
                  {calendarDays.days.map((dayItem) => {
                    const isBooked = dayItem.status === 'booked';
                    const isAvailable = dayItem.status === 'available';
                    const isUnavailable = dayItem.status === 'unavailable';
                    const isToggling = togglingDate === dayItem.dateStr;

                    let bgClass = 'bg-emerald-50/80 border-emerald-200 text-emerald-900';
                    let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    let label = 'Available';

                    if (isBooked) {
                      bgClass = 'bg-blue-50/80 border-blue-200 text-blue-900';
                      badgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
                      label = 'Booked';
                    } else if (isUnavailable) {
                      bgClass = 'bg-slate-100/90 border-slate-200 text-slate-600';
                      badgeClass = 'bg-slate-200 text-slate-700 border-slate-300';
                      label = 'Unavailable';
                    }

                    return (
                      <button
                        key={dayItem.dateStr}
                        type="button"
                        data-testid={`day-${dayItem.dateStr}`}
                        data-status={dayItem.status}
                        data-date={dayItem.dateStr}
                        onClick={() => handleDayClick(dayItem)}
                        disabled={!isTourGuide || isToggling}
                        aria-label={`${MONTH_NAMES[currentMonth]} ${dayItem.dayNum}, ${currentYear}: ${label}`}
                        className={`group relative flex min-h-24 flex-col justify-between p-2 text-left transition sm:min-h-28 sm:p-2.5 ${bgClass} ${
                          isTourGuide && !isBooked
                            ? 'cursor-pointer hover:ring-2 hover:ring-brand-500/50 hover:shadow-xs'
                            : isTourGuide && isBooked
                            ? 'cursor-not-allowed opacity-90'
                            : 'cursor-default'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-heading text-sm font-bold ${
                              isBooked
                                ? 'text-blue-900'
                                : isAvailable
                                ? 'text-emerald-950'
                                : 'text-slate-600'
                            }`}
                          >
                            {dayItem.dayNum}
                          </span>

                          {isToggling && (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                          )}
                        </div>

                        <div className="mt-2">
                          <span
                            className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold sm:text-xs ${badgeClass}`}
                          >
                            {label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Explanatory footer */}
              <div className="mt-4 flex flex-col justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400 sm:flex-row">
                <p>
                  * Days without explicit availability records are treated as <strong>Available</strong> by default.
                </p>
                {isTourGuide && <p>Click to toggle. Booked tours are locked to prevent scheduling conflicts.</p>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
