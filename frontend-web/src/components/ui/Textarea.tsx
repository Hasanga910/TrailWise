import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { Field } from './Field';
import { FIELD_BASE } from './fields';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, wrapperClassName, className, id: idProp, rows = 4, ...rest },
  ref,
) {
  return (
    <Field id={idProp} label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(FIELD_BASE, 'resize-y', className)}
          {...rest}
        />
      )}
    </Field>
  );
});
