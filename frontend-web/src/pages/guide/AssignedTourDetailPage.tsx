import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import {
  getAssignedTours,
  updateGuideTour,
  type AssignedTourDto,
} from '../../api/guides';

export function AssignedTourDetailPage() {
  const { id: bookingId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tour, setTour] = useState<AssignedTourDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [attended, setAttended] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    getAssignedTours()
      .then((tours) => {
        const found = tours.find((t) => t.bookingId === bookingId);
        if (found) {
          setTour(found);
          setAttended(found.attended);
          setCompleted(found.completed);
          setNotes(found.guideNotes ?? '');
        } else {
          setError('Tour assignment not found.');
        }
      })
      .catch((err) => {
        setError(extractErrorMessage(err, 'Failed to load tour details.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [bookingId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!bookingId) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const updated = await updateGuideTour(bookingId, {
        attended,
        completed,
        notes: notes.trim().length > 0 ? notes.trim() : null,
      });
      setTour(updated);
      setAttended(updated.attended);
      setCompleted(updated.completed);
      setNotes(updated.guideNotes ?? '');
      setSaveSuccess('Tour updates saved successfully.');
    } catch (err) {
      setSaveError(extractErrorMessage(err, 'Failed to save tour updates.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/guide/tours')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          ← Back to Assigned Tours
        </button>
        {bookingId && (
          <Link
            to={`/guide/tours/${bookingId}/itinerary`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 shadow-xs hover:bg-brand-100"
          >
            View / Edit Itinerary →
          </Link>
        )}
      </div>

      {loading && (
        <div className="flex min-h-60 items-center justify-center rounded-xl border border-slate-200 bg-white p-8">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
              aria-hidden="true"
            />
            <span>Loading tour details...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Error</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {!loading && tour && (
        <div className="space-y-6">
          {/* Header & Overview Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                  {tour.theme}
                </span>
                <h2 className="font-heading text-xl font-bold text-slate-900">
                  {tour.tourPackageName}
                </h2>
              </div>
              <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Status: {tour.status}
              </span>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs font-medium text-slate-500">Dates</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                  {tour.startDate} to {tour.endDate}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs font-medium text-slate-500">Group Size</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                  {tour.groupSize} {tour.groupSize === 1 ? 'traveler' : 'travelers'}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Locations</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                  {tour.locations.length > 0 ? tour.locations.join(', ') : 'None listed'}
                </dd>
              </div>
              {tour.specialRequests && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
                  <dt className="text-xs font-medium text-amber-700">Special Requests</dt>
                  <dd className="mt-0.5 text-sm text-amber-900">{tour.specialRequests}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Guide Management Form Card */}
          <form
            onSubmit={handleSave}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5"
          >
            <div>
              <h3 className="font-heading text-base font-bold text-slate-900">
                Tour Operations & Notes
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Update attendance, mark tour completion, and write operational notes.
              </p>
            </div>

            {saveSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {saveSuccess}
              </div>
            )}

            {saveError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {saveError}
              </div>
            )}

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attended}
                  onChange={(e) => setAttended(e.target.checked)}
                  disabled={saving}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800">Attended</span>
                  <p className="text-xs text-slate-500">
                    Confirm that the group was present and met for this tour.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                  disabled={saving}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800">Completed</span>
                  <p className="text-xs text-slate-500">
                    Mark this tour assignment as fully delivered and completed.
                  </p>
                </div>
              </label>

              <div>
                <label htmlFor="guideNotes" className="block text-sm font-semibold text-slate-800">
                  Guide Notes
                </label>
                <p className="text-xs text-slate-500 mb-1.5">
                  Record any operational observations, traveler notes, or incidents (max 2000 chars).
                </p>
                <textarea
                  id="guideNotes"
                  rows={4}
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={saving}
                  placeholder="Enter guide notes..."
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <div className="text-right text-xs text-slate-400">
                  {notes.length} / 2000
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Updates'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
