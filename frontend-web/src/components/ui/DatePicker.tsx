import { useEffect, useId, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import 'react-day-picker/style.css';
import { cn } from './cn';
import { Field } from './Field';
import { FIELD_BASE } from './fields';

export interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Dates before this are not selectable. */
  minDate?: Date;
  className?: string;
}

export function DatePicker({ value, onChange, label, hint, error, placeholder = 'Select date', disabled, minDate, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <div ref={rootRef} className="relative">
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={popId}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onClick={() => setOpen((o) => !o)}
            className={cn(FIELD_BASE, 'flex items-center justify-between text-left', !value && 'text-fg-muted')}
          >
            <span>{value ? format(value, 'PPP') : placeholder}</span>
            <CalendarDays className="h-4 w-4 text-fg-muted" aria-hidden />
          </button>
          {open && (
            <div
              id={popId}
              role="dialog"
              aria-label="Choose date"
              className="tw-day-picker absolute z-40 mt-2 rounded-card border border-border bg-surface-raised p-3 shadow-raised"
            >
              <DayPicker
                mode="single"
                selected={value}
                disabled={minDate ? { before: minDate } : undefined}
                defaultMonth={value}
                onSelect={(d) => {
                  onChange(d);
                  setOpen(false);
                }}
              />
            </div>
          )}
        </div>
      )}
    </Field>
  );
}
