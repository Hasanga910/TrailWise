import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';
import { Field } from './Field';
import { FIELD_BASE } from './fields';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, wrapperClassName, className, id: idProp, ...rest },
  ref,
) {
  return (
    <Field id={idProp} label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          ref={ref}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(FIELD_BASE, className)}
          {...rest}
        />
      )}
    </Field>
  );
});
