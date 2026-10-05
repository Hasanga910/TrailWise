import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge, Button, Input } from '../ui';

interface SpecializationInputProps {
  specializations: string[];
  error: string | null;
  /** Returns true when the value was accepted, so the input can clear itself. */
  onAdd: (value: string) => boolean;
  onRemove: (value: string) => void;
  onEdit: () => void;
}

/** Free-text tag input for a guide's specializations. */
export function SpecializationInput({ specializations, error, onAdd, onRemove, onEdit }: SpecializationInputProps) {
  const [value, setValue] = useState('');

  function add() {
    if (onAdd(value)) setValue('');
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2" data-testid="specialization-chips">
        {specializations.map((spec) => (
          <Badge key={spec} className="gap-1.5 py-1 pr-1.5">
            <span>{spec}</span>
            <button
              type="button"
              aria-label={`Remove ${spec}`}
              onClick={() => onRemove(spec)}
              className="rounded-full p-0.5 hover:bg-fg/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </Badge>
        ))}
        {specializations.length === 0 && <span className="text-caption italic text-fg-muted">No specializations added yet.</span>}
      </div>

      <div className="flex gap-2">
        <Input
          wrapperClassName="flex-1"
          type="text"
          aria-label="Add Specialization"
          data-testid="specialization-input"
          placeholder="e.g. Wildlife, Hiking, Cultural"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) onEdit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" aria-label="Add Specialization Button" onClick={add}>
          + Add
        </Button>
      </div>
      {error && <p className="mt-1 text-caption font-medium text-danger-fg">{error}</p>}
    </div>
  );
}
