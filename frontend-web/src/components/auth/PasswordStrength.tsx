import { cn } from '../ui/cn';
import { passwordStrength, type StrengthLevel } from './strengthScore';

const BAR_COLOR: Record<StrengthLevel, string> = {
  0: 'bg-border',
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-info',
  4: 'bg-success',
};

/** Four-segment meter with a text label, so colour is never the only signal. */
export function PasswordStrength({ password, className }: { password: string; className?: string }) {
  const { level, label, hint } = passwordStrength(password);

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn('h-1.5 flex-1 rounded-full transition-colors duration-200', segment <= level ? BAR_COLOR[level] : 'bg-border')}
          />
        ))}
      </div>
      <p aria-live="polite" className="min-h-5 text-caption text-fg-muted">
        {level > 0 && (
          <>
            Password strength: <span className="font-semibold text-fg">{label}</span>
            {hint && <> · {hint}</>}
          </>
        )}
      </p>
    </div>
  );
}
