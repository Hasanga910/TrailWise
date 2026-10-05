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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-surface-raised p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info-soft text-info">
            <UsersIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-fg">Guide Assignment Fallback</h1>
            <p className="text-sm text-fg-muted">
              Manage manual tour guide assignments for bookings where automatic matching required manual review.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Pending Guide Review</p>
          <p className="mt-2 text-2xl font-bold text-warning">{pendingBookings.length}</p>
          <p className="mt-1 text-xs text-fg-muted">Needs manual guide assignment</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Total Bookings Loaded</p>
          <p className="mt-2 text-2xl font-bold text-fg">{bookings?.length ?? 0}</p>
          <p className="mt-1 text-xs text-fg-muted">System bookings</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Role Responsibility</p>
          <p className="mt-2 text-base font-bold text-fg">Fleet Coordinator</p>
          <p className="mt-1 text-xs text-fg-muted">Vehicles, drivers &amp; guide fallbacks</p>
        </div>
      </div>

      {/* Notifications */}

      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-fg">
          {error}
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="rounded-2xl border border-border bg-surface-raised p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search by traveler, tour package, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-fg focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <span className="text-xs font-medium text-fg-muted">
            Showing {filteredBookings.length} of {pendingBookings.length} pending assignments
          </span>
        </div>
      </div>

      {/* Main Table / Content */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-r-transparent mb-2" />
            <p>Loading bookings needing review...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success mb-3">
              <UsersIcon className="h-6 w-6" />
            </div>
            <h3 className="font-heading text-base font-semibold text-fg">No Pending Guide Assignments</h3>
            <p className="mt-1 text-sm text-fg-muted">
              {searchQuery
                ? 'No review bookings matched your search query.'
                : 'All bookings currently have assigned guides or are processed.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-fg-muted">
              <thead className="border-b border-border bg-surface-sunken text-xs font-semibold uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="px-6 py-4">Booking ID</th>
                  <th className="px-6 py-4">Traveler</th>
                  <th className="px-6 py-4">Tour Package</th>
                  <th className="px-6 py-4">Schedule</th>
                  <th className="px-6 py-4">Group Size</th>
                  <th className="px-6 py-4">Language Pref</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-sunken/80 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-medium text-fg-muted">
                      {b.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 font-semibold text-fg">{b.travelerName}</td>
                    <td className="px-6 py-4 text-fg">{b.packageName}</td>
                    <td className="px-6 py-4 text-fg-muted whitespace-nowrap">
                      {b.startDate}
                      {b.endDate ? ` → ${b.endDate}` : ''}
                    </td>
                    <td className="px-6 py-4 text-fg">
                      <span className="font-semibold text-fg">{b.groupSize}</span> guests
                    </td>
                    <td className="px-6 py-4 text-fg-muted">
                      {b.languagePreference ? (
                        <span className="inline-flex items-center rounded-md bg-info-soft px-2 py-1 text-xs font-medium text-info-fg ring-1 ring-inset ring-info/10">
                          {b.languagePreference}
                        </span>
                      ) : (
                        <span className="text-xs text-fg-muted">None specified</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-fg ring-1 ring-inset ring-warning/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {b.status === 'NeedsManualReview' && !b.assignedGuide ? (
                        <button
                          type="button"
                          onClick={() => handleOpenAssignModal(b)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-800 transition focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <UsersIcon className="h-3.5 w-3.5" />
                          Assign Tour Guide
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-fg ring-1 ring-inset ring-success/20">
                          Guide Assigned
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guide Assignment Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-surface-raised shadow-2xl overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border bg-surface-sunken/50 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
                  <UsersIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-fg">Assign Tour Guide</h3>
                  <p className="text-xs text-fg-muted">Select an available guide to resolve this manual review.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-lg p-1.5 text-fg-muted hover:bg-neutral-soft hover:text-fg-muted"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {/* Booking Summary Box */}
              <div className="rounded-xl border border-border bg-surface-sunken/80 p-4 text-sm">
                <h4 className="font-semibold text-fg mb-2">Booking Details</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:text-sm text-fg-muted">
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

              {/* Conflict or Assignment Error Banner */}

              {/* Available Guides Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-fg">Available Tour Guides</h4>
                  {availableGuides && (
                    <span className="text-xs text-fg-muted">
                      {availableGuides.length} guide{availableGuides.length === 1 ? '' : 's'} available
                    </span>
                  )}
                </div>

                {loadingGuides && (
                  <div className="space-y-3 py-4">
                    <div className="h-16 animate-pulse rounded-xl bg-neutral-soft" />
                    <div className="h-16 animate-pulse rounded-xl bg-neutral-soft" />
                  </div>
                )}

                {guidesError && (
                  <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger-fg">
                    <p>{guidesError}</p>
                    <button
                      type="button"
                      onClick={() => fetchAvailableGuides(selectedBooking.id)}
                      className="mt-2 text-xs font-semibold text-brand-text underline hover:text-brand-text"
                    >
                      Retry Loading Guides
                    </button>
                  </div>
                )}

                {!loadingGuides && !guidesError && availableGuides !== null && availableGuides.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-fg-muted">
                    <p className="font-medium text-fg">No available guides found for these dates.</p>
                    <p className="mt-1 text-xs text-fg-muted">All registered guides are busy or have conflicts.</p>
                  </div>
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
                          className={`cursor-pointer rounded-xl border p-4 transition-all ${
                            isSelected
                              ? 'border-brand-500 bg-brand-soft/50 shadow-sm ring-1 ring-brand-500'
                              : 'border-border hover:border-border hover:bg-surface-sunken/60'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="selectedGuide"
                                checked={isSelected}
                                onChange={() => setSelectedGuideId(guide.guideId)}
                                className="h-4 w-4 text-brand-text focus:ring-brand-500"
                              />
                              <div>
                                <span className="font-semibold text-fg">{guide.name}</span>
                                <span className="ml-2 text-xs text-fg-muted">{guide.contactInfo}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {guide.matchesSpecialization && (
                                <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success-fg border border-success/30">
                                  Theme Match
                                </span>
                              )}
                              {guide.matchesLanguage && (
                                <span className="rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-medium text-info-fg border border-info/30">
                                  Language Match
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 space-y-1 pl-7 text-xs text-fg-muted">
                            <div>
                              <span className="font-medium text-fg">Languages: </span>
                              {guide.languages.join(', ') || 'None listed'}
                            </div>
                            <div>
                              <span className="font-medium text-fg">Specializations: </span>
                              {guide.specializations.join(', ') || 'None listed'}
                            </div>
                            {guide.notes && (
                              <div className="mt-1.5 font-medium text-brand-text bg-brand-soft/60 rounded px-2 py-1 border border-brand-500/30">
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

            {/* Modal Footer */}
            <div className="border-t border-border bg-surface-sunken/50 px-6 py-4">
              {isConfirming ? (
                <div className="rounded-xl border border-warning/30 bg-warning-soft p-4">
                  <p className="text-sm font-medium text-warning-fg">
                    Assign{' '}
                    <strong>
                      {availableGuides?.find((g) => g.guideId === selectedGuideId)?.name}
                    </strong>{' '}
                    to this booking?
                  </p>
                  <p className="mt-1 text-xs text-warning-fg">
                    This will reserve the guide across the tour dates and confirm the booking if vehicles are allocated.
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={isAssigning}
                      onClick={() => setIsConfirming(false)}
                      className="rounded-lg border border-border bg-surface-raised px-3.5 py-1.5 text-xs font-semibold text-fg hover:bg-surface-sunken transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isAssigning}
                      onClick={handleConfirmAssignment}
                      className="rounded-lg bg-brand-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 transition disabled:opacity-50"
                    >
                      {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-fg hover:bg-neutral-soft transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedGuideId || loadingGuides}
                    onClick={() => setIsConfirming(true)}
                    className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800 transition disabled:opacity-50 shadow-sm"
                  >
                    Assign Guide
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
