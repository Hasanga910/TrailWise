import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from './cn';
import { Field } from './Field';
import { FIELD_BASE } from './fields';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

/** Password field with a show/hide toggle. The toggle is a real button with a state-aware label. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { label, hint, error, wrapperClassName, className, id: idProp, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <Field id={idProp} label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? 'text' : 'password'}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(FIELD_BASE, 'pr-11', className)}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-muted transition hover:text-fg"
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      )}
    </Field>
  );
});
