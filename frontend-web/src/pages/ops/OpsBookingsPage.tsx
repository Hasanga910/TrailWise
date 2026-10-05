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
import { Button, buttonClasses, Card, EmptyState, Modal, PageHeader, Skeleton, StatusBadge, Textarea } from '../../components/ui';
import { notify } from '../../components/ui/notify';

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
      <PageHeader title="Bookings" description="All traveler booking requests." />

      {error && (
        <p role="alert" className="mb-4 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
          {error}
        </p>
      )}

      {!error && bookings === null && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-card border border-border bg-surface-raised" />
          ))}
        </div>
      )}

      {!error && bookings !== null && bookings.length === 0 && (
        <Card padded={false} className="border-dashed">
          <EmptyState title="No bookings yet." />
        </Card>
      )}

      {bookings && bookings.length > 0 && (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border bg-surface-sunken text-left text-caption font-semibold uppercase tracking-wide text-fg-muted">
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
                        <StatusBadge status={booking.status} label={booking.status} className="whitespace-nowrap" />
                      </td>
                      <td className="px-4 py-3 text-fg-muted">{booking.createdAt}</td>
                      <td className="px-4 py-3 text-fg-muted">{booking.startDate}</td>
                      <td className="px-4 py-3 text-fg-muted">{booking.groupSize}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canApprove && (
                            <Button size="sm" disabled={isActioning} onClick={() => handleApprove(booking.id)}>
                              Approve
                            </Button>
                          )}
                          {canReject && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="border-danger/30 text-danger-fg"
                              disabled={isActioning}
                              onClick={() => setPrompt({ kind: 'reject', bookingId: booking.id, text: '' })}
                            >
                              Reject
                            </Button>
                          )}
                          {canComplete && (
                            <Button size="sm" variant="secondary" disabled={isActioning} onClick={() => handleComplete(booking.id)}>
                              Mark Completed
                            </Button>
                          )}
                          {canCancel && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isActioning}
                              onClick={() => setPrompt({ kind: 'cancel', bookingId: booking.id, text: '' })}
                            >
                              Cancel
                            </Button>
                          )}
                          {booking.status === 'Confirmed' && (
                            <Button size="sm" variant="secondary" onClick={() => toggleItinerary(booking.id)}>
                              {isExpanded ? 'Hide Itinerary' : 'Itinerary'}
                            </Button>
                          )}

                          <Link to={`/ops/bookings/${booking.id}/workflow`} className={buttonClasses('secondary', 'sm')}>
                            View agent workflow
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${booking.id}-itinerary`}>
                        <td colSpan={7} className="border-t border-border bg-surface-sunken px-4 py-4">
                          {itineraryLoadingId === booking.id && <Skeleton className="h-12 bg-surface-raised" />}
                          {itineraryErrors[booking.id] && (
                            <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-fg">
                              {itineraryErrors[booking.id]}
                            </p>
                          )}
                          {itineraryCache[booking.id] && editingItineraryId !== booking.id && (
                            <div className="space-y-3">
                              <ItineraryList steps={itineraryCache[booking.id]} />
                              <Button size="sm" variant="secondary" onClick={() => setEditingItineraryId(booking.id)}>
                                {itineraryCache[booking.id].length > 0 ? 'Edit Itinerary' : 'Set Itinerary'}
                              </Button>
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
        </Card>
      )}

      <Modal
        open={prompt !== null}
        onClose={() => setPrompt(null)}
        size="sm"
        title={prompt?.kind === 'reject' ? 'Reject booking' : 'Cancel booking'}
        footer={
          prompt && (
            <>
              <Button variant="secondary" onClick={() => setPrompt(null)}>
                Back
              </Button>
              <Button type="submit" form="booking-prompt-form" variant="danger" loading={actioningId === prompt.bookingId}>
                {prompt.kind === 'reject' ? 'Reject' : 'Confirm cancellation'}
              </Button>
            </>
          )
        }
      >
        {prompt && (
          <form id="booking-prompt-form" onSubmit={handlePromptSubmit}>
            <Textarea
              id="booking-prompt-text"
              label={prompt.kind === 'reject' ? 'Notes (optional)' : 'Reason (optional)'}
              value={prompt.text}
              onChange={(e) => setPrompt({ ...prompt, text: e.target.value })}
              rows={3}
            />
          </form>
        )}
      </Modal>
    </div>
  );
}
