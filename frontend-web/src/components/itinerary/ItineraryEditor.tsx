import { useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { setItinerary, type ItineraryStepDto, type ItineraryStepInput } from '../../api/itineraries';

interface EditableStep {
  dayNumber: number;
  activity: string;
  location: string;
  startTime: string; // 'HH:mm' for <input type="time">
}

function toEditable(steps: ItineraryStepDto[]): EditableStep[] {
  return steps.map((s) => ({
    dayNumber: s.dayNumber,
    activity: s.activity,
    location: s.location,
    startTime: s.startTime.slice(0, 5),
  }));
}

export function ItineraryEditor({
  bookingId,
  initialSteps,
  onSaved,
  onCancel,
}: {
  bookingId: string;
  initialSteps: ItineraryStepDto[];
  onSaved: (steps: ItineraryStepDto[]) => void;
  onCancel?: () => void;
}) {
  const [rows, setRows] = useState<EditableStep[]>(
    initialSteps.length > 0
      ? toEditable(initialSteps)
      : [{ dayNumber: 1, activity: '', location: '', startTime: '09:00' }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<EditableStep>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const lastDay = rows.length > 0 ? rows[rows.length - 1].dayNumber : 0;
    setRows((prev) => [...prev, { dayNumber: lastDay + 1, activity: '', location: '', startTime: '09:00' }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const input: ItineraryStepInput[] = rows.map((r) => ({
        dayNumber: r.dayNumber,
        activity: r.activity,
        location: r.location,
        startTime: `${r.startTime}:00`,
      }));
      const saved = await setItinerary(bookingId, input);
      onSaved(saved);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not save the itinerary.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[80px_1fr_1fr_110px_auto] sm:items-end"
        >
          <div>
            <label className="text-xs font-semibold text-slate-500">Day</label>
            <input
              type="number"
              min={1}
              value={row.dayNumber}
              onChange={(e) => updateRow(index, { dayNumber: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Activity</label>
            <input
              type="text"
              value={row.activity}
              maxLength={300}
              onChange={(e) => updateRow(index, { activity: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Location</label>
            <input
              type="text"
              value={row.location}
              maxLength={300}
              onChange={(e) => updateRow(index, { location: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Start time</label>
            <input
              type="time"
              value={row.startTime}
              onChange={(e) => updateRow(index, { startTime: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => removeRow(index)}
              disabled={rows.length === 1}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Add Day
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Itinerary'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
