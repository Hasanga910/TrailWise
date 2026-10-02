import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import {
  getMyAssignedTours,
  updateGuideTour,
  type AssignedTourDto,
} from '../../api/assignedTours';
import { getItinerary, type ItineraryStepDto } from '../../api/itineraries';
import { useAuth } from '../../auth/AuthContext';
import { ItineraryEditor } from '../../components/itinerary/ItineraryEditor';
import { ItineraryList } from '../../components/itinerary/ItineraryList';

function formatDateTime(dtStr?: string | null) {
  if (!dtStr) return '';
  const dt = new Date(dtStr);
  return dt.toLocaleString();
}

export function TourDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user, logout } = useAuth();

  const [tour, setTour] = useState<AssignedTourDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [attended, setAttended] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [itinerarySteps, setItinerarySteps] = useState<ItineraryStepDto[] | null>(null);
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  const [editingItinerary, setEditingItinerary] = useState(false);

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
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await updateGuideTour(bookingId, {
        attended,
        notes: notes.trim() ? notes.trim() : null,
      });
      setTour(updated);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(extractErrorMessage(err, 'Could not save tour updates.'));
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-svh bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{loadError}</div>
        <Link to="/guides/my-tours" className="mt-4 inline-block text-sm font-semibold text-brand-700">
          &larr; Back to my tours
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-brand-500 before:via-accent-500 before:to-brand-500">
        <div className="flex items-center gap-4">
          <Link to="/guides/my-tours" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            &larr; My Tours
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/guides/profile"
            className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 sm:inline-block"
          >
            Profile
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-700">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        {!tour && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {tour && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-heading text-xl font-bold text-slate-900">{tour.tourPackageName}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {tour.theme} · {tour.startDate} to {tour.endDate} · {tour.groupSize} traveler
                {tour.groupSize === 1 ? '' : 's'}
              </p>
              {tour.locations.length > 0 && (
                <p className="mt-2 text-sm text-slate-600">Locations: {tour.locations.join(', ')}</p>
              )}
              {tour.specialRequests && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Special requests: {tour.specialRequests}
                </div>
              )}
            </div>

            {/* Tour Lifecycle Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-heading text-base font-bold text-slate-900">Tour Lifecycle</h3>

              <div className="mt-4">
                {tour.tourEndedAt ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="font-semibold text-emerald-900">Completed</p>
                    {tour.tourStartedAt && (
                      <p className="mt-1 text-xs text-emerald-800">
                        Started at: {formatDateTime(tour.tourStartedAt)}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-emerald-800">
                      Ended at: {formatDateTime(tour.tourEndedAt)}
                    </p>
                  </div>
                ) : tour.tourStartedAt ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="font-semibold text-amber-900">In Progress</p>
                    <p className="mt-1 text-xs text-amber-800">
                      Started at: {formatDateTime(tour.tourStartedAt)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-700">Not Started</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-heading text-base font-bold text-slate-900">Tour Management</h3>

              {saveError && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {saveError}
                </p>
              )}
              {saveSuccess && !saveError && (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  Tour updates saved.
                </p>
              )}

              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={attended}
                    onChange={(e) => setAttended(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Attended
                </label>
                <div>
                  <label htmlFor="guide-notes" className="text-xs font-semibold text-slate-500">
                    Guide Notes
                  </label>
                  <textarea
                    id="guide-notes"
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-base font-bold text-slate-900">Itinerary</h3>
                {tour.status === 'Confirmed' && !editingItinerary && (
                  <button
                    type="button"
                    onClick={() => setEditingItinerary(true)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {itinerarySteps && itinerarySteps.length > 0 ? 'Edit Itinerary' : 'Set Itinerary'}
                  </button>
                )}
              </div>

              {tour.status !== 'Confirmed' && (
                <p className="mt-3 text-sm text-slate-500">Available once this booking is confirmed.</p>
              )}

              {tour.status === 'Confirmed' && itineraryError && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {itineraryError}
                </p>
              )}

              {tour.status === 'Confirmed' && !itineraryError && itinerarySteps === null && (
                <div className="mt-3 h-16 animate-pulse rounded-lg bg-slate-100" />
              )}

              {tour.status === 'Confirmed' && itinerarySteps !== null && !editingItinerary && (
                <div className="mt-3">
                  <ItineraryList steps={itinerarySteps} />
                </div>
              )}

              {tour.status === 'Confirmed' && itinerarySteps !== null && editingItinerary && (
                <div className="mt-3">
                  <ItineraryEditor
                    bookingId={tour.bookingId}
                    initialSteps={itinerarySteps}
                    onSaved={(saved) => {
                      setItinerarySteps(saved);
                      setEditingItinerary(false);
                    }}
                    onCancel={() => setEditingItinerary(false)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
