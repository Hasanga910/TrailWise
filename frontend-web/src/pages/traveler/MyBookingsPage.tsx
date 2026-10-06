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
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, Skeleton, StatusBadge, Textarea } from '../../components/ui';
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
      <PageHeader title="My Bookings" description="Track the status of your booking requests." />

      <Card className="mb-6 grid gap-4 p-4 sm:grid-cols-3">
        <Select id="statusFilter" label="Status" value={status} onChange={(e) => handleStatusChange(e.target.value)}>
          <option value="">All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Input id="fromFilter" label="From" type="date" value={from} onChange={(e) => handleFromChange(e.target.value)} />
        <Input id="toFilter" label="To" type="date" value={to} onChange={(e) => handleToChange(e.target.value)} />
      </Card>

      {error && (
        <p role="alert" className="mb-4 rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
          {error}
        </p>
      )}

      {!error && loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </Card>
          ))}
        </div>
      )}

      {!error && !loading && result && result.items.length === 0 && (
        <Card padded={false} className="border-dashed">
          <EmptyState title="No bookings match your filters." />
        </Card>
      )}

      {!error && !loading && result && result.items.length > 0 && (
        <>
          <div className="space-y-3">
            {result.items.map((booking) => (
              <Card key={booking.id} className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-fg">
                      {booking.tourPackageName} — {booking.packageTier.classType}
                    </p>
                    <p className="mt-0.5 text-body text-fg-muted">
                      {booking.startDate} to {booking.endDate} · {booking.groupSize} traveler
                      {booking.groupSize === 1 ? '' : 's'} · ${booking.budgetPerPerson.toFixed(2)}/person budget
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {booking.isLargeGroup && (
                      <Badge tone="warning" className="whitespace-nowrap">
                        Large group
                      </Badge>
                    )}
                    <StatusBadge status={booking.status} className="whitespace-nowrap" />
                    {booking.status === 'Confirmed' && (
                      <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => toggleItinerary(booking.id)}>
                        {expandedBookingId === booking.id ? 'Hide Itinerary' : 'View Itinerary'}
                      </Button>
                    )}
                    {CANCELLABLE_STATUSES.includes(booking.status) && isUpcoming(booking.startDate) && !booking.tourStartedAt && !booking.tourEndedAt && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="whitespace-nowrap"
                        onClick={() => setCancelPrompt({ bookingId: booking.id, reason: '' })}
                      >
                        Cancel Booking
                      </Button>
                    )}
                  </div>
                </div>

                {booking.status !== 'Cancelled' && (
                  booking.assignedGuide ? (
                    <div className="mt-3 rounded-input border border-border bg-surface-sunken p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-overline text-fg-muted">Assigned Tour Guide</span>
                        <Badge tone="success">Assigned</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-body sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <span className="block text-caption font-medium text-fg-muted">Name</span>
                          <span className="font-semibold text-fg">{booking.assignedGuide.name}</span>
                        </div>
                        <div>
                          <span className="block text-caption font-medium text-fg-muted">Contact Number</span>
                          <span className="text-fg">{booking.assignedGuide.contactInfo || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="block text-caption font-medium text-fg-muted">Languages</span>
                          <span className="text-fg">
                            {booking.assignedGuide.languages.length > 0
                              ? booking.assignedGuide.languages.join(' • ')
                              : 'None specified'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-caption font-medium text-fg-muted">Specializations</span>
                          <span className="text-fg">
                            {booking.assignedGuide.specializations.length > 0
                              ? booking.assignedGuide.specializations.join(', ')
                              : 'General'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 text-caption text-fg-muted">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
                      <span>Tour Guide not assigned yet</span>
                    </div>
                  )
                )}

                {expandedBookingId === booking.id && (
                  <div className="mt-4 space-y-4 border-t border-border pt-4">
                    {assignmentCache[booking.id] && (
                      <div className="rounded-input border border-border bg-surface-sunken p-4">
                        <h4 className="mb-3 text-overline text-fg-muted">Assigned Transport & Crew</h4>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <p className="text-caption font-medium text-fg-muted">Vehicle</p>
                            <p className="text-body font-semibold text-fg">
                              {assignmentCache[booking.id]?.vehicleName || 'Assigned Vehicle'}
                            </p>
                            <p className="text-caption text-fg-muted">
                              {assignmentCache[booking.id]?.registrationNumber && (
                                <span className="font-mono font-medium">{assignmentCache[booking.id]?.registrationNumber} · </span>
                              )}
                              {assignmentCache[booking.id]?.vehicleType}
                              {assignmentCache[booking.id]?.hasAC ? ' (AC)' : ''}
                            </p>
                          </div>
                          <div>
                            <p className="text-caption font-medium text-fg-muted">Driver</p>
                            <p className="text-body font-semibold text-fg">
                              {assignmentCache[booking.id]?.driverName || 'Driver'}
                            </p>
                            <p className="text-caption text-fg-muted">
                              {assignmentCache[booking.id]?.driverContact || 'Contact pending'}
                            </p>
                          </div>
                          {assignmentCache[booking.id]?.guideName && (
                            <div>
                              <p className="text-caption font-medium text-fg-muted">Tour Guide</p>
                              <p className="text-body font-semibold text-fg">
                                {assignmentCache[booking.id]?.guideName}
                              </p>
                              <p className="text-caption text-fg-muted">
                                {assignmentCache[booking.id]?.guideContact || 'Contact pending'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {itineraryLoadingId === booking.id && <Skeleton className="h-12" />}
                    {itineraryErrors[booking.id] && (
                      <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-fg">
                        {itineraryErrors[booking.id]}
                      </p>
                    )}
                    {itineraryCache[booking.id] && <ItineraryList steps={itineraryCache[booking.id]} />}
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button variant="secondary" disabled={isFirstPage} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span className="text-body text-fg-muted">
              Page {page} of {totalPages}
            </span>
            <Button variant="secondary" disabled={isLastPage} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}

      <Modal
        open={cancelPrompt !== null}
        onClose={() => setCancelPrompt(null)}
        size="sm"
        title="Cancel booking"
        description="Are you sure you want to cancel this booking?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelPrompt(null)}>
              Back
            </Button>
            <Button type="submit" form="cancel-booking-form" variant="danger" loading={cancelling}>
              Confirm cancellation
            </Button>
          </>
        }
      >
        {cancelPrompt && (
          <form id="cancel-booking-form" onSubmit={handleCancelSubmit}>
            <Textarea
              id="cancel-reason"
              label="Reason (optional)"
              value={cancelPrompt.reason}
              onChange={(e) => setCancelPrompt({ ...cancelPrompt, reason: e.target.value })}
              rows={3}
            />
          </form>
        )}
      </Modal>
    </div>
  );
}
