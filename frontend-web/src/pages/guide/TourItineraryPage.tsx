import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import {
  getItinerary,
  setItinerary,
  type ItineraryStepDto,
  type ItineraryStepRequest,
} from '../../api/itineraries';

interface StepDraft {
  id?: string;
  dayNumber: number;
  activity: string;
  location: string;
  startTime: string;
}

export function TourItineraryPage({
  bookingIdProp,
  backUrl,
}: {
  bookingIdProp?: string;
  backUrl?: string;
}) {
  const { id: paramBookingId } = useParams<{ id: string }>();
  const bookingId = bookingIdProp ?? paramBookingId;
  const navigate = useNavigate();

  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New step form inputs
  const [newDay, setNewDay] = useState<number | string>(1);
  const [newTime, setNewTime] = useState('09:00');
  const [newActivity, setNewActivity] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function loadItinerary() {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    getItinerary(bookingId)
      .then((data: ItineraryStepDto[]) => {
        setSteps(
          data.map((s) => ({
            id: s.id,
            dayNumber: s.dayNumber,
            activity: s.activity,
            location: s.location,
            startTime: s.startTime?.slice(0, 5) ?? '09:00',
          })),
        );
      })
      .catch((err) => {
        setError(extractErrorMessage(err, 'Failed to load itinerary.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    loadItinerary();
  }, [bookingId]);

  function handleAddStep(e: FormEvent) {
    e.preventDefault();
    setStepError(null);

    const activity = newActivity.trim();
    const location = newLocation.trim();
    const day = typeof newDay === 'number' ? newDay : parseInt(newDay, 10);

    if (!day || day <= 0) {
      setStepError('Day number must be greater than 0.');
      return;
    }
    if (!activity) {
      setStepError('Activity is required.');
      return;
    }
    if (activity.length > 300) {
      setStepError('Activity cannot exceed 300 characters.');
      return;
    }
    if (!location) {
      setStepError('Location is required.');
      return;
    }
    if (location.length > 300) {
      setStepError('Location cannot exceed 300 characters.');
      return;
    }

    // Check duplicate
    const exists = steps.some(
      (s) => s.dayNumber === day && s.startTime === newTime,
    );
    if (exists) {
      setStepError(`A step is already scheduled for Day ${day} at ${newTime}.`);
      return;
    }

    const newStepItem: StepDraft = {
      dayNumber: day,
      startTime: newTime,
      activity,
      location,
    };

    const updated = [...steps, newStepItem].sort((a, b) => {
      if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
      return a.startTime.localeCompare(b.startTime);
    });

    setSteps(updated);
    setNewActivity('');
    setNewLocation('');
    setStepError(null);
  }

  function handleRemoveStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveItinerary() {
    if (!bookingId) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const payload: ItineraryStepRequest[] = steps.map((s) => ({
      dayNumber: s.dayNumber,
      activity: s.activity,
      location: s.location,
      startTime: s.startTime.length === 5 ? `${s.startTime}:00` : s.startTime,
    }));

    try {
      const saved = await setItinerary(bookingId, payload);
      setSteps(
        saved.map((s) => ({
          id: s.id,
          dayNumber: s.dayNumber,
          activity: s.activity,
          location: s.location,
          startTime: s.startTime?.slice(0, 5) ?? '09:00',
        })),
      );
      setSaveSuccess('Itinerary saved successfully.');
    } catch (err) {
      setSaveError(extractErrorMessage(err, 'Failed to save itinerary.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (backUrl) navigate(backUrl);
            else if (bookingId) navigate(`/guide/tours/${bookingId}`);
            else navigate(-1);
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          ← Back
        </button>
        <div className="text-right">
          <p className="text-xs font-mono text-slate-400">Booking: {bookingId}</p>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-xl font-bold text-slate-900">Tour Itinerary</h2>
        <p className="mt-1 text-sm text-slate-500">
          View, organize, and schedule daily steps, locations, and activities for this tour booking.
        </p>
      </div>

      {loading && (
        <div className="flex min-h-60 items-center justify-center rounded-xl border border-slate-200 bg-white p-8">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
              aria-hidden="true"
            />
            <span>Loading itinerary...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Unable to load itinerary</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={loadItinerary}
            className="mt-3 inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
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

          {/* Current Steps List */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-heading text-base font-bold text-slate-900">
                  Scheduled Steps ({steps.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Daily plan for the tour group.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveItinerary}
                disabled={saving}
                className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Itinerary Changes'}
              </button>
            </div>

            {steps.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                <p className="font-medium text-slate-700">No itinerary steps defined yet.</p>
                <p className="mt-1">Add your first day activity below and save.</p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {steps.map((step, idx) => (
                  <div
                    key={`${step.dayNumber}-${step.startTime}-${idx}`}
                    className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center justify-center rounded-lg bg-brand-50 px-2.5 py-1 text-center text-brand-700">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Day</span>
                        <span className="text-base font-bold leading-tight">{step.dayNumber}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono font-medium text-slate-600">
                            {step.startTime}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">
                            {step.activity}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          📍 {step.location}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="self-end text-xs font-semibold text-red-600 hover:text-red-700 sm:self-center"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Step Card */}
          <form
            onSubmit={handleAddStep}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
          >
            <h3 className="font-heading text-base font-bold text-slate-900">
              Add New Itinerary Step
            </h3>

            {stepError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {stepError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label htmlFor="stepDay" className="block text-xs font-semibold text-slate-700 mb-1">
                  Day Number
                </label>
                <input
                  id="stepDay"
                  type="number"
                  min={1}
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="stepTime" className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Time
                </label>
                <input
                  id="stepTime"
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="stepActivity" className="block text-xs font-semibold text-slate-700 mb-1">
                  Activity
                </label>
                <input
                  id="stepActivity"
                  type="text"
                  maxLength={300}
                  placeholder="e.g. Guided Waterfall Hike"
                  value={newActivity}
                  onChange={(e) => setNewActivity(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  required
                />
              </div>

              <div className="sm:col-span-4">
                <label htmlFor="stepLocation" className="block text-xs font-semibold text-slate-700 mb-1">
                  Location
                </label>
                <input
                  id="stepLocation"
                  type="text"
                  maxLength={300}
                  placeholder="e.g. Ella Rock Summit"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800"
              >
                + Add Step to Itinerary
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
