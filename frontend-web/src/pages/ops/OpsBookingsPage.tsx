import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import {
  cancelBooking,
  completeBooking,
  decideBooking,
  getAllBookings,
  type BookingStatus,
  type BookingSummaryDto,
} from '../../api/bookings';
import { getItinerary, type ItineraryStepDto } from '../../api/itineraries';
import { ItineraryEditor } from '../../components/itinerary/ItineraryEditor';
import { ItineraryList } from '../../components/itinerary/ItineraryList';
import { notify } from '../../components/ui/notify';

const STATUS_STYLES: Record<BookingStatus, string> = {
  Requested: 'bg-neutral-soft text-fg-muted',
  PlanProposed: 'bg-accent-500/15 text-warning-fg',
  PendingApproval: 'bg-warning-soft text-warning-fg',
  Confirmed: 'bg-brand-soft text-brand-text',
  Completed: 'bg-success-soft text-success-fg',
  Cancelled: 'bg-danger-soft text-danger-fg',
  NeedsManualReview: 'bg-danger-soft text-danger-fg',
};

const CANCELLABLE_STATUSES: BookingStatus[] = [
  'Requested',
  'PlanProposed',
  'PendingApproval',
  'NeedsManualReview',
  'Confirmed',
];

type PromptKind = 'reject' | 'cancel';

interface PromptState {
  kind: PromptKind;
  bookingId: string;
  text: string;
}

export function OpsBookingsPage() {
  const [bookings, setBookings] = useState<BookingSummaryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);

  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [itineraryCache, setItineraryCache] = useState<Record<string, ItineraryStepDto[]>>({});
  const [itineraryLoadingId, setItineraryLoadingId] = useState<string | null>(null);
  const [itineraryErrors, setItineraryErrors] = useState<Record<string, string>>({});
  const [editingItineraryId, setEditingItineraryId] = useState<string | null>(null);



  function toggleItinerary(bookingId: string) {
    if (expandedBookingId === bookingId) {
      setExpandedBookingId(null);
      setEditingItineraryId(null);
      return;
    }
    setExpandedBookingId(bookingId);
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

  function load() {
    getAllBookings()
      .then((data) => {
        setBookings(data);
        setError(null);
      })
      .catch((err) => setError(extractErrorMessage(err, 'Could not load bookings.')));
  }

  useEffect(() => {
    load();
  }, []);

  function patchStatus(bookingId: string, status: BookingStatus) {
    setBookings((prev) => prev?.map((b) => (b.id === bookingId ? { ...b, status } : b)) ?? prev);
  }

  async function handleApprove(bookingId: string) {
    setActioningId(bookingId);
    try {
      const updated = await decideBooking(bookingId, { decision: 'Approve' });
      patchStatus(bookingId, updated.status);
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Could not approve this booking.'));
    } finally {
      setActioningId(null);
    }
  }

  async function handleComplete(bookingId: string) {
    setActioningId(bookingId);
    try {
      const updated = await completeBooking(bookingId);
      patchStatus(bookingId, updated.status);
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Could not mark this booking as completed.'));
    } finally {
      setActioningId(null);
    }
  }

  async function handlePromptSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt) {
      return;
    }
    const { kind, bookingId, text } = prompt;
    setActioningId(bookingId);
    try {
      const updated =
        kind === 'reject'
          ? await decideBooking(bookingId, { decision: 'Reject', notes: text || undefined })
          : await cancelBooking(bookingId, text || undefined);
      patchStatus(bookingId, updated.status);
      setPrompt(null);
    } catch (err) {
      notify.error(extractErrorMessage(err, kind === 'reject' ? 'Could not reject this booking.' : 'Could not cancel this booking.'),);
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-heading text-xl font-bold text-fg">Bookings</h2>
        <p className="mt-1 text-sm text-fg-muted">All traveler booking requests.</p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-fg">
          {error}
        </p>
      )}



      {!error && bookings === null && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-surface-raised" />
          ))}
        </div>
      )}

      {!error && bookings !== null && bookings.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
          <p className="font-medium text-fg-muted">No bookings yet.</p>
        </div>
      )}

      {bookings && bookings.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-raised shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">
                <th className="px-4 py-3">Traveler</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Start date</th>
                <th className="px-4 py-3">Group size</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.map((booking) => {
                const isActioning = actioningId === booking.id;
                const canApprove =
                  booking.status === 'PendingApproval' ||
                  booking.status === 'PlanProposed';
                const canReject =
                  booking.status === 'PendingApproval' ||
                  booking.status === 'NeedsManualReview' ||
                  booking.status === 'PlanProposed';
                const canComplete = booking.status === 'Confirmed';
                const canCancel = CANCELLABLE_STATUSES.includes(booking.status);

                const isExpanded = expandedBookingId === booking.id;

                return (
                  <Fragment key={booking.id}>
                    <tr className="transition hover:bg-surface-sunken">
                      <td className="px-4 py-3 font-medium text-fg">{booking.travelerName}</td>
                      <td className="px-4 py-3 text-fg-muted">{booking.packageName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[booking.status]}`}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-fg-muted">{booking.createdAt}</td>
                      <td className="px-4 py-3 text-fg-muted">{booking.startDate}</td>
                      <td className="px-4 py-3 text-fg-muted">{booking.groupSize}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canApprove && (
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleApprove(booking.id)}
                              className="rounded-lg border border-success/30 px-3 py-1.5 text-sm font-semibold text-success-fg transition hover:bg-success-soft disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                          {canReject && (
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => setPrompt({ kind: 'reject', bookingId: booking.id, text: '' })}
                              className="rounded-lg border border-danger/30 px-3 py-1.5 text-sm font-semibold text-danger-fg transition hover:bg-danger-soft disabled:opacity-50"
                            >
                              Reject
                            </button>
                          )}
                          {canComplete && (
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleComplete(booking.id)}
                              className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-fg transition hover:bg-surface-sunken disabled:opacity-50"
                            >
                              Mark Completed
                            </button>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => setPrompt({ kind: 'cancel', bookingId: booking.id, text: '' })}
                              className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-fg transition hover:bg-surface-sunken disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                          {booking.status === 'Confirmed' && (
                            <button
                              type="button"
                              onClick={() => toggleItinerary(booking.id)}
                              className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-fg transition hover:bg-surface-sunken"
                            >
                              {isExpanded ? 'Hide Itinerary' : 'Itinerary'}
                            </button>
                          )}

                          <Link
                            to={`/ops/bookings/${booking.id}/workflow`}
                            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-fg transition hover:bg-surface-sunken"
                          >
                            View agent workflow
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${booking.id}-itinerary`}>
                        <td colSpan={7} className="border-t border-border bg-surface-sunken px-4 py-4">
                          {itineraryLoadingId === booking.id && (
                            <div className="h-12 animate-pulse rounded-lg bg-surface-raised" />
                          )}
                          {itineraryErrors[booking.id] && (
                            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-fg">
                              {itineraryErrors[booking.id]}
                            </p>
                          )}
                          {itineraryCache[booking.id] && editingItineraryId !== booking.id && (
                            <div className="space-y-3">
                              <ItineraryList steps={itineraryCache[booking.id]} />
                              <button
                                type="button"
                                onClick={() => setEditingItineraryId(booking.id)}
                                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-fg hover:bg-surface-raised"
                              >
                                {itineraryCache[booking.id].length > 0 ? 'Edit Itinerary' : 'Set Itinerary'}
                              </button>
                            </div>
                          )}
                          {itineraryCache[booking.id] && editingItineraryId === booking.id && (
                            <ItineraryEditor
                              bookingId={booking.id}
                              initialSteps={itineraryCache[booking.id]}
                              onSaved={(saved) => {
                                setItineraryCache((prev) => ({ ...prev, [booking.id]: saved }));
                                setEditingItineraryId(null);
                              }}
                              onCancel={() => setEditingItineraryId(null)}
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {prompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-surface-raised p-6 shadow-lg">
            <h3 className="font-heading text-base font-bold text-fg">
              {prompt.kind === 'reject' ? 'Reject booking' : 'Cancel booking'}
            </h3>
            <form onSubmit={handlePromptSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="booking-prompt-text" className="mb-1 block text-sm font-medium text-fg">
                  {prompt.kind === 'reject' ? 'Notes (optional)' : 'Reason (optional)'}
                </label>
                <textarea
                  id="booking-prompt-text"
                  value={prompt.text}
                  onChange={(e) => setPrompt({ ...prompt, text: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPrompt(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-fg transition hover:bg-surface-sunken"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={actioningId === prompt.bookingId}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {prompt.kind === 'reject' ? 'Reject' : 'Confirm cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
