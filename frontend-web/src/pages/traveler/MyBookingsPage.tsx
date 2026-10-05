import { useState, useEffect, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  cancelBooking,
  getMyBookings,
  type BookingDto,
  type BookingStatus,
  type PagedResult,
} from '../../api/bookings';
import { getItinerary, type ItineraryStepDto } from '../../api/itineraries';
import { getAssignmentByBookingId, type VehicleAssignmentDetailDto } from '../../api/vehicles';
import { ItineraryList } from '../../components/itinerary/ItineraryList';
import { notify } from '../../components/ui/notify';

const PAGE_SIZE = 10;

const CANCELLABLE_STATUSES: BookingStatus[] = [
  'Requested',
  'PlanProposed',
  'PendingApproval',
  'NeedsManualReview',
  'Confirmed',
];

function isUpcoming(startDate: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return startDate >= today;
}

const STATUS_OPTIONS = [
  'Cancelled',
  'Completed',
  'Confirmed',
  'Pending',
] as const;

type StatusFilterOption = (typeof STATUS_OPTIONS)[number];

const STATUS_STYLES: Record<BookingStatus, string> = {
  Requested: 'bg-neutral-soft text-fg-muted',
  PlanProposed: 'bg-accent-500/15 text-warning-fg',
  PendingApproval: 'bg-warning-soft text-warning-fg',
  Confirmed: 'bg-brand-soft text-brand-text',
  Completed: 'bg-success-soft text-success-fg',
  Cancelled: 'bg-danger-soft text-danger-fg',
  NeedsManualReview: 'bg-danger-soft text-danger-fg',
};

const inputClass =
  'w-full rounded-lg border border-border px-3 py-2 text-sm text-fg focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const labelClass = 'text-xs font-semibold text-fg-muted';

export function MyBookingsPage() {
  const [status, setStatus] = useState<StatusFilterOption | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<PagedResult<BookingDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancelPrompt, setCancelPrompt] = useState<{ bookingId: string; reason: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [itineraryCache, setItineraryCache] = useState<Record<string, ItineraryStepDto[]>>({});
  const [itineraryLoadingId, setItineraryLoadingId] = useState<string | null>(null);
  const [itineraryErrors, setItineraryErrors] = useState<Record<string, string>>({});
  const [assignmentCache, setAssignmentCache] = useState<Record<string, VehicleAssignmentDetailDto | null>>({});

  function toggleItinerary(bookingId: string) {
    if (expandedBookingId === bookingId) {
      setExpandedBookingId(null);
      return;
    }
    setExpandedBookingId(bookingId);

    if (!assignmentCache[bookingId]) {
      getAssignmentByBookingId(bookingId)
        .then((assignment) => {
          setAssignmentCache((prev) => ({ ...prev, [bookingId]: assignment }));
        })
        .catch(() => {
          // assignment is optional, ignore error
        });
    }

    if (itineraryCache[bookingId]) {
      return;
    }
    setItineraryLoadingId(bookingId);
    getItinerary(bookingId)
      .then((steps) => setItineraryCache((prev) => ({ ...prev, [bookingId]: steps })))
      .catch((err) =>
        setItineraryErrors((prev) => ({
          ...prev,
          [bookingId]: extractErrorMessage(err, 'Could not load the itinerary.'),
        })),
      )
      .finally(() => setItineraryLoadingId(null));
  }

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      getMyBookings({
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
        .then((data) => {
          setResult(data);
          setError(null);
        })
        .catch((err) => setError(extractErrorMessage(err, 'Could not load your bookings.')))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [status, from, to, page]);

  function handleStatusChange(value: string) {
    setStatus(value as StatusFilterOption | '');
    setPage(1);
  }

  function handleFromChange(value: string) {
    setFrom(value);
    setPage(1);
  }

  function handleToChange(value: string) {
    setTo(value);
    setPage(1);
  }

  async function handleCancelSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cancelPrompt) return;
    setCancelling(true);
    try {
      const updated = await cancelBooking(cancelPrompt.bookingId, cancelPrompt.reason || undefined);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((b) => (b.id === updated.id ? { ...b, status: updated.status } : b)),
            }
          : prev,
      );
      setCancelPrompt(null);
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Could not cancel this booking.'));
    } finally {
      setCancelling(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.totalCount / result.pageSize)) : 1;
  const isFirstPage = page <= 1;
  const isLastPage = result ? page * result.pageSize >= result.totalCount : true;

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-heading text-xl font-bold text-fg">My Bookings</h2>
        <p className="mt-1 text-sm text-fg-muted">Track the status of your booking requests.</p>
      </div>

      <div className="mb-6 grid gap-4 rounded-xl border border-border bg-surface-raised p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="statusFilter" className={labelClass}>
            Status
          </label>
          <select
            id="statusFilter"
            className={inputClass}
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fromFilter" className={labelClass}>
            From
          </label>
          <input
            id="fromFilter"
            type="date"
            className={inputClass}
            value={from}
            onChange={(e) => handleFromChange(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="toFilter" className={labelClass}>
            To
          </label>
          <input
            id="toFilter"
            type="date"
            className={inputClass}
            value={to}
            onChange={(e) => handleToChange(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-fg">
          {error}
        </p>
      )}

      {!error && loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-surface-raised p-4">
              <div className="h-4 w-1/3 rounded bg-neutral-soft" />
              <div className="mt-2 h-4 w-1/2 rounded bg-neutral-soft" />
            </div>
          ))}
        </div>
      )}

      {!error && !loading && result && result.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
          <p className="font-medium text-fg-muted">No bookings match your filters.</p>
        </div>
      )}

      {!error && !loading && result && result.items.length > 0 && (
        <>
          <div className="space-y-3">
            {result.items.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-border bg-surface-raised p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-fg">
                      {booking.tourPackageName} — {booking.packageTier.classType}
                    </p>
                    <p className="mt-0.5 text-sm text-fg-muted">
                      {booking.startDate} to {booking.endDate} · {booking.groupSize} traveler
                      {booking.groupSize === 1 ? '' : 's'} · ${booking.budgetPerPerson.toFixed(2)}/person budget
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.isLargeGroup && (
                      <span className="whitespace-nowrap rounded-full bg-accent-500/15 px-2.5 py-0.5 text-xs font-semibold text-warning-fg">
                        Large group
                      </span>
                    )}
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[booking.status]}`}
                    >
                      {booking.status}
                    </span>
                    {booking.status === 'Confirmed' && (
                      <button
                        type="button"
                        onClick={() => toggleItinerary(booking.id)}
                        className="whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-fg transition hover:bg-surface-sunken"
                      >
                        {expandedBookingId === booking.id ? 'Hide Itinerary' : 'View Itinerary'}
                      </button>
                    )}
                    {CANCELLABLE_STATUSES.includes(booking.status) && isUpcoming(booking.startDate) && !booking.tourStartedAt && !booking.tourEndedAt && (
                      <button
                        type="button"
                        onClick={() => setCancelPrompt({ bookingId: booking.id, reason: '' })}
                        className="whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-fg transition hover:bg-surface-sunken"
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                </div>

                {booking.status !== 'Cancelled' && (
                  booking.assignedGuide ? (
                    <div className="mt-3 rounded-lg border border-border bg-surface-sunken/70 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                            Assigned Tour Guide
                          </span>
                          <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-fg">
                            Assigned
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <span className="block text-xs font-medium text-fg-muted">Name</span>
                          <span className="font-semibold text-fg">{booking.assignedGuide.name}</span>
                        </div>
                        <div>
                          <span className="block text-xs font-medium text-fg-muted">Contact Number</span>
                          <span className="text-fg">{booking.assignedGuide.contactInfo || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="block text-xs font-medium text-fg-muted">Languages</span>
                          <span className="text-fg">
                            {booking.assignedGuide.languages.length > 0
                              ? booking.assignedGuide.languages.join(' • ')
                              : 'None specified'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-medium text-fg-muted">Specializations</span>
                          <span className="text-fg">
                            {booking.assignedGuide.specializations.length > 0
                              ? booking.assignedGuide.specializations.join(', ')
                              : 'General'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 text-xs text-fg-muted">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span>Tour Guide not assigned yet</span>
                    </div>
                  )
                )}

                {expandedBookingId === booking.id && (
                  <div className="mt-4 border-t border-border pt-4 space-y-4">
                    {assignmentCache[booking.id] && (
                      <div className="rounded-lg border border-border bg-surface-sunken p-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-3">
                          Assigned Transport & Crew
                        </h4>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <p className="text-xs font-medium text-fg-muted">Vehicle</p>
                            <p className="text-sm font-semibold text-fg">
                              {assignmentCache[booking.id]?.vehicleName || 'Assigned Vehicle'}
                            </p>
                            <p className="text-xs text-fg-muted">
                              {assignmentCache[booking.id]?.registrationNumber && (
                                <span className="font-mono font-medium">{assignmentCache[booking.id]?.registrationNumber} · </span>
                              )}
                              {assignmentCache[booking.id]?.vehicleType}
                              {assignmentCache[booking.id]?.hasAC ? ' (AC)' : ''}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-fg-muted">Driver</p>
                            <p className="text-sm font-semibold text-fg">
                              {assignmentCache[booking.id]?.driverName || 'Driver'}
                            </p>
                            <p className="text-xs text-fg-muted">
                              {assignmentCache[booking.id]?.driverContact || 'Contact pending'}
                            </p>
                          </div>
                          {assignmentCache[booking.id]?.guideName && (
                            <div>
                              <p className="text-xs font-medium text-fg-muted">Tour Guide</p>
                              <p className="text-sm font-semibold text-fg">
                                {assignmentCache[booking.id]?.guideName}
                              </p>
                              <p className="text-xs text-fg-muted">
                                {assignmentCache[booking.id]?.guideContact || 'Contact pending'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {itineraryLoadingId === booking.id && (
                      <div className="h-12 animate-pulse rounded-lg bg-neutral-soft" />
                    )}
                    {itineraryErrors[booking.id] && (
                      <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-fg">
                        {itineraryErrors[booking.id]}
                      </p>
                    )}
                    {itineraryCache[booking.id] && <ItineraryList steps={itineraryCache[booking.id]} />}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              disabled={isFirstPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-fg-muted">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={isLastPage}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}

      {cancelPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-surface-raised p-6 shadow-lg">
            <h3 className="font-heading text-base font-bold text-fg">Cancel booking</h3>
            <p className="mt-1 text-sm text-fg-muted">Are you sure you want to cancel this booking?</p>
            <form onSubmit={handleCancelSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="cancel-reason" className="mb-1 block text-sm font-medium text-fg">
                  Reason (optional)
                </label>
                <textarea
                  id="cancel-reason"
                  value={cancelPrompt.reason}
                  onChange={(e) => setCancelPrompt({ ...cancelPrompt, reason: e.target.value })}
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelPrompt(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-fg transition hover:bg-surface-sunken"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
