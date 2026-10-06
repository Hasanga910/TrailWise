import { useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { Button, Input } from '../ui';
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
      {error && <p className="rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-fg">{error}</p>}

      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-2 gap-2 rounded-input border border-border p-3 sm:grid-cols-[80px_1fr_1fr_110px_auto] sm:items-end"
        >
          <Input
            label="Day"
            type="number"
            min={1}
            value={row.dayNumber}
            onChange={(e) => updateRow(index, { dayNumber: Number(e.target.value) })}
          />
          <Input
            label="Activity"
            type="text"
            value={row.activity}
            maxLength={300}
            onChange={(e) => updateRow(index, { activity: e.target.value })}
          />
          <Input
            label="Location"
            type="text"
            value={row.location}
            maxLength={300}
            onChange={(e) => updateRow(index, { location: e.target.value })}
          />
          <Input
            label="Start time"
            type="time"
            value={row.startTime}
            onChange={(e) => updateRow(index, { startTime: e.target.value })}
          />
          <Button variant="secondary" size="sm" onClick={() => removeRow(index)} disabled={rows.length === 1}>
            Remove
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={addRow}>
          Add Day
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Itinerary'}
        </Button>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
