import { useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  assignGuide,
  getAllBookings,
  getAvailableGuidesForBooking,
  type AvailableGuideDto,
  type BookingSummaryDto,
} from '../../api/bookings';
import { UsersIcon } from '../../components/admin/icons';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Skeleton, StatusBadge, cn } from '../../components/ui';
import { notify } from '../../components/ui/notify';

export function FleetGuideAssignmentsPage() {
  const [bookings, setBookings] = useState<BookingSummaryDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Guide Assignment Modal state
  const [selectedBooking, setSelectedBooking] = useState<BookingSummaryDto | null>(null);
  const [availableGuides, setAvailableGuides] = useState<AvailableGuideDto[] | null>(null);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [guidesError, setGuidesError] = useState<string | null>(null);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  function loadBookings() {
    setError(null);
    getAllBookings()
      .then((data) => setBookings(data))
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load bookings.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBookings();
  }, []);

  function fetchAvailableGuides(bookingId: string) {
    setLoadingGuides(true);
    setGuidesError(null);
    getAvailableGuidesForBooking(bookingId)
      .then((guides) => setAvailableGuides(guides))
      .catch((err) => setGuidesError(extractErrorMessage(err, 'Could not load available guides.')))
      .finally(() => setLoadingGuides(false));
  }

  function handleOpenAssignModal(booking: BookingSummaryDto) {
    if (booking.assignedGuide) return;
    setSelectedBooking(booking);
    setSelectedGuideId(null);
    setIsConfirming(false);
    fetchAvailableGuides(booking.id);
  }

  function handleCloseModal() {
    setSelectedBooking(null);
    setSelectedGuideId(null);
    setIsConfirming(false);
    setAvailableGuides(null);
  }

  async function handleConfirmAssignment() {
    if (!selectedBooking || !selectedGuideId || isAssigning) return;

    setIsAssigning(true);

    try {
      const res = await assignGuide(selectedBooking.id, selectedGuideId);

      // Update local state immediately so row/button disappears without waiting for network
      setBookings((prev) =>
        prev
          ? prev.map((b) =>
              b.id === selectedBooking.id
                ? {
                    ...b,
                    status: res.status ?? b.status,
                    assignedGuide: {
                      id: selectedGuideId,
                      name: availableGuides?.find((g) => g.guideId === selectedGuideId)?.name ?? 'Assigned Guide',
                      languages: availableGuides?.find((g) => g.guideId === selectedGuideId)?.languages ?? [],
                      specializations: availableGuides?.find((g) => g.guideId === selectedGuideId)?.specializations ?? [],
                    },
                  }
                : b,
            )
          : prev,
      );

      notify.success(`Tour Guide successfully assigned to booking ${selectedBooking.id.slice(0, 8)}! ${
          res.status === 'Confirmed' ? 'Booking is now Confirmed.' : 'Guide allocation saved.'
        }`,);
      handleCloseModal();
      loadBookings();
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Selected guide is no longer available for this booking.'));
      setIsConfirming(false);
      // Refresh available guides list so Fleet Coordinator can retry
      fetchAvailableGuides(selectedBooking.id);
    } finally {
      setIsAssigning(false);
    }
  }

  // Filter only bookings in NeedsManualReview status that genuinely still require a guide
  const pendingBookings = bookings?.filter((b) => b.status === 'NeedsManualReview' && !b.assignedGuide) ?? [];

  const filteredBookings = pendingBookings.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.id.toLowerCase().includes(q) ||
      b.travelerName.toLowerCase().includes(q) ||
      b.packageName.toLowerCase().includes(q) ||
      (b.languagePreference && b.languagePreference.toLowerCase().includes(q))
    );
  });

  const selectedGuideName = availableGuides?.find((g) => g.guideId === selectedGuideId)?.name;

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-info-soft text-info-fg">
            <UsersIcon className="h-6 w-6" />
          </div>
          <PageHeader
            as="h1"
            title="Guide Assignment Fallback"
            description="Manage manual tour guide assignments for bookings where automatic matching required manual review."
            className="mb-0"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-overline text-fg-muted">Pending Guide Review</p>
          <p className="mt-2 font-heading text-h2 text-warning-fg">{pendingBookings.length}</p>
          <p className="mt-1 text-caption text-fg-muted">Needs manual guide assignment</p>
        </Card>
        <Card>
          <p className="text-overline text-fg-muted">Total Bookings Loaded</p>
          <p className="mt-2 font-heading text-h2 text-fg">{bookings?.length ?? 0}</p>
          <p className="mt-1 text-caption text-fg-muted">System bookings</p>
        </Card>
        <Card>
          <p className="text-overline text-fg-muted">Role Responsibility</p>
          <p className="mt-2 font-heading text-h4 text-fg">Fleet Coordinator</p>
          <p className="mt-1 text-caption text-fg-muted">Vehicles, drivers &amp; guide fallbacks</p>
        </Card>
      </div>

      {error && (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
          {error}
        </div>
      )}

      <Card className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <Input
          wrapperClassName="w-full sm:max-w-md"
          type="text"
          aria-label="Search pending assignments"
          placeholder="Search by traveler, tour package, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="text-caption font-medium text-fg-muted">
          Showing {filteredBookings.length} of {pendingBookings.length} pending assignments
        </span>
      </Card>

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6" role="status" aria-label="Loading bookings">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
            <span className="sr-only">Loading bookings needing review...</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="h-8 w-8" />}
            title="No Pending Guide Assignments"
            description={
              searchQuery
                ? 'No review bookings matched your search query.'
                : 'All bookings currently have assigned guides or are processed.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body text-fg-muted">
              <thead className="border-b border-border bg-surface-sunken text-caption font-semibold uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="px-3 py-4">Booking ID</th>
                  <th className="px-3 py-4">Traveler</th>
                  <th className="px-3 py-4">Tour Package</th>
                  <th className="px-3 py-4">Schedule</th>
                  <th className="px-3 py-4">Group Size</th>
                  <th className="px-3 py-4">Language Pref</th>
                  <th className="px-3 py-4">Status</th>
                  <th className="px-3 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBookings.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-surface-sunken/80">
                    <td className="px-3 py-4 font-mono text-caption font-medium text-fg-muted">{b.id.slice(0, 8)}...</td>
                    <td className="px-3 py-4 font-semibold text-fg">{b.travelerName}</td>
                    <td className="px-3 py-4 text-fg">{b.packageName}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-fg-muted">
                      {b.startDate}
                      {b.endDate ? ` → ${b.endDate}` : ''}
                    </td>
                    <td className="px-3 py-4 text-fg">
                      <span className="font-semibold text-fg">{b.groupSize}</span> guests
                    </td>
                    <td className="px-3 py-4 text-fg-muted">
                      {b.languagePreference ? (
                        <Badge tone="info">{b.languagePreference}</Badge>
                      ) : (
                        <span className="text-caption text-fg-muted">None specified</span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge status={b.status} className="whitespace-nowrap" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right">
                      {b.status === 'NeedsManualReview' && !b.assignedGuide ? (
                        <Button size="sm" leftIcon={<UsersIcon className="h-3.5 w-3.5" />} onClick={() => handleOpenAssignModal(b)}>
                          Assign Tour Guide
                        </Button>
                      ) : (
                        <Badge tone="success">Guide Assigned</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={selectedBooking !== null}
        onClose={handleCloseModal}
        size="lg"
        title="Assign Tour Guide"
        description="Select an available guide to resolve this manual review."
        footer={
          isConfirming ? (
            <div className="w-full rounded-card border border-warning/30 bg-warning-soft p-4">
              <p className="text-body font-medium text-warning-fg">
                Assign <strong>{selectedGuideName}</strong> to this booking?
              </p>
              <p className="mt-1 text-caption text-warning-fg">
                This will reserve the guide across the tour dates and confirm the booking if vehicles are allocated.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="secondary" size="sm" disabled={isAssigning} onClick={() => setIsConfirming(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={isAssigning} onClick={handleConfirmAssignment}>
                  {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="secondary" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button disabled={!selectedGuideId || loadingGuides} onClick={() => setIsConfirming(true)}>
                Assign Guide
              </Button>
            </>
          )
        }
      >
        {selectedBooking && (
          <div className="space-y-5">
            <div className="rounded-card border border-border bg-surface-sunken p-4 text-body">
              <h4 className="mb-2 font-semibold text-fg">Booking Details</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-caption text-fg-muted sm:text-body">
                <div>
                  <span className="font-medium text-fg">Traveler: </span>
                  <span className="font-semibold text-fg">{selectedBooking.travelerName}</span>
                </div>
                <div>
                  <span className="font-medium text-fg">Tour Package: </span>
                  <span className="font-semibold text-fg">{selectedBooking.packageName}</span>
                </div>
                <div>
                  <span className="font-medium text-fg">Dates: </span>
                  {selectedBooking.startDate}
                  {selectedBooking.endDate ? ` to ${selectedBooking.endDate}` : ''}
                </div>
                <div>
                  <span className="font-medium text-fg">Group Size: </span>
                  {selectedBooking.groupSize} guests
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-fg">Language Preference: </span>
                  {selectedBooking.languagePreference || 'None specified'}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-semibold text-fg">Available Tour Guides</h4>
                {availableGuides && (
                  <span className="text-caption text-fg-muted">
                    {availableGuides.length} guide{availableGuides.length === 1 ? '' : 's'} available
                  </span>
                )}
              </div>

              {loadingGuides && (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              )}

              {guidesError && (
                <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-body text-danger-fg">
                  <p>{guidesError}</p>
                  <Button variant="secondary" size="sm" className="mt-2" onClick={() => fetchAvailableGuides(selectedBooking.id)}>
                    Retry Loading Guides
                  </Button>
                </div>
              )}

              {!loadingGuides && !guidesError && availableGuides !== null && availableGuides.length === 0 && (
                <EmptyState
                  title="No available guides found for these dates."
                  description="All registered guides are busy or have conflicts."
                  className="rounded-card border border-dashed border-border py-8"
                />
              )}

              {!loadingGuides && !guidesError && availableGuides && availableGuides.length > 0 && (
                <div className="space-y-2.5">
                  {availableGuides.map((guide) => {
                    const isSelected = selectedGuideId === guide.guideId;
                    return (
                      <div
                        key={guide.guideId}
                        onClick={() => {
                          if (!isConfirming) setSelectedGuideId(guide.guideId);
                        }}
                        className={cn(
                          'cursor-pointer rounded-card border p-4 transition-all',
                          isSelected
                            ? 'border-brand-500 bg-brand-soft/50 ring-1 ring-brand-500'
                            : 'border-border hover:bg-surface-sunken/60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="selectedGuide"
                              checked={isSelected}
                              onChange={() => setSelectedGuideId(guide.guideId)}
                              className="h-4 w-4 accent-brand-600"
                            />
                            <div>
                              <span className="font-semibold text-fg">{guide.name}</span>
                              <span className="ml-2 text-caption text-fg-muted">{guide.contactInfo}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {guide.matchesSpecialization && <Badge tone="success">Theme Match</Badge>}
                            {guide.matchesLanguage && <Badge tone="info">Language Match</Badge>}
                          </div>
                        </div>

                        <div className="mt-2 space-y-1 pl-7 text-caption text-fg-muted">
                          <div>
                            <span className="font-medium text-fg">Languages: </span>
                            {guide.languages.join(', ') || 'None listed'}
                          </div>
                          <div>
                            <span className="font-medium text-fg">Specializations: </span>
                            {guide.specializations.join(', ') || 'None listed'}
                          </div>
                          {guide.notes && (
                            <div className="mt-1.5 rounded border border-brand-500/30 bg-brand-soft px-2 py-1 font-medium text-brand-text">
                              {guide.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
