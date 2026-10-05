import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import {
  getMyAssignedTours,
  updateGuideTour,
  type AssignedTourDto,
} from '../../api/assignedTours';
import { getItinerary, type ItineraryStepDto } from '../../api/itineraries';
import { ItineraryList } from '../../components/itinerary/ItineraryList';
import { notify } from '../../components/ui/notify';

function formatDateTime(dtStr?: string | null) {
  if (!dtStr) return '';
  const dt = new Date(dtStr);
  return dt.toLocaleString();
}

export function TourDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();

  const [tour, setTour] = useState<AssignedTourDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [attended, setAttended] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [itinerarySteps, setItinerarySteps] = useState<ItineraryStepDto[] | null>(null);
  const [itineraryError, setItineraryError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    getMyAssignedTours()
      .then((tours) => {
        const found = tours.find((t) => t.bookingId === bookingId);
        if (!found) {
          setLoadError('This tour is not assigned to you.');
          return;
        }
        setTour(found);
        setAttended(found.attended);
        setNotes(found.guideNotes ?? '');
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Could not load this tour.')));
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId || !tour || tour.status !== 'Confirmed') return;
    getItinerary(bookingId)
      .then(setItinerarySteps)
      .catch((err) => setItineraryError(extractErrorMessage(err, 'Could not load the itinerary.')));
  }, [bookingId, tour]);

  async function handleSave() {
    if (!bookingId) return;
    setSaving(true);
    try {
      const updated = await updateGuideTour(bookingId, {
        attended,
        notes: notes.trim() ? notes.trim() : null,
      });
      setTour(updated);
      notify.success('Tour updates saved.');
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Could not save tour updates.'));
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-svh bg-surface-sunken px-6 py-10">
        <div role="alert" className="mx-auto max-w-2xl rounded-xl border border-danger/30 bg-danger-soft p-4 text-danger-fg">{loadError}</div>
        <Link to="/guides/my-tours" className="mt-4 inline-block text-sm font-semibold text-brand-text">
          &larr; Back to my tours
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
        {!tour && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface-raised" />
            ))}
          </div>
        )}

        {tour && (
          <>
            <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
              <h2 className="font-heading text-xl font-bold text-fg">{tour.tourPackageName}</h2>
              <p className="mt-1 text-sm text-fg-muted">
                {tour.theme} · {tour.startDate} to {tour.endDate} · {tour.groupSize} traveler
                {tour.groupSize === 1 ? '' : 's'}
              </p>
              {tour.locations.length > 0 && (
                <p className="mt-2 text-sm text-fg-muted">Locations: {tour.locations.join(', ')}</p>
              )}
              {tour.specialRequests && (
                <div className="mt-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning-fg">
                  Special requests: {tour.specialRequests}
                </div>
              )}
            </div>

            {/* Tour Lifecycle Card */}
            <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
              <h3 className="font-heading text-base font-bold text-fg">Tour Lifecycle</h3>

              <div className="mt-4">
                {tour.tourEndedAt ? (
                  <div className="rounded-lg border border-success/30 bg-success-soft p-4">
                    <p className="font-semibold text-success-fg">Completed</p>
                    {tour.tourStartedAt && (
                      <p className="mt-1 text-xs text-success-fg">
                        Started at: {formatDateTime(tour.tourStartedAt)}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-success-fg">
                      Ended at: {formatDateTime(tour.tourEndedAt)}
                    </p>
                  </div>
                ) : tour.tourStartedAt ? (
                  <div className="rounded-lg border border-warning/30 bg-warning-soft p-4">
                    <p className="font-semibold text-warning-fg">In Progress</p>
                    <p className="mt-1 text-xs text-warning-fg">
                      Started at: {formatDateTime(tour.tourStartedAt)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-surface-sunken p-4">
                    <p className="font-semibold text-fg">Not Started</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
              <h3 className="font-heading text-base font-bold text-fg">Tour Management</h3>


              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-fg">
                  <input
                    type="checkbox"
                    checked={attended}
                    onChange={(e) => setAttended(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Attended
                </label>
                <div>
                  <label htmlFor="guide-notes" className="text-xs font-semibold text-fg-muted">
                    Guide Notes
                  </label>
                  <textarea
                    id="guide-notes"
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
              <h3 className="font-heading text-base font-bold text-fg">Itinerary</h3>

              {tour.status !== 'Confirmed' && (
                <p className="mt-3 text-sm text-fg-muted">Available once this booking is confirmed.</p>
              )}

              {tour.status === 'Confirmed' && itineraryError && (
                <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-fg">
                  {itineraryError}
                </p>
              )}

              {tour.status === 'Confirmed' && !itineraryError && itinerarySteps === null && (
                <div className="mt-3 h-16 animate-pulse rounded-lg bg-neutral-soft" />
              )}

              {tour.status === 'Confirmed' && itinerarySteps !== null && (
                <div className="mt-3">
                  <ItineraryList steps={itinerarySteps} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
  );
}
