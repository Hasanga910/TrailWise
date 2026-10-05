export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface StrengthResult {
  level: StrengthLevel;
  label: string;
  /** What would make it stronger, shortest useful hint first. */
  hint: string | null;
}

const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/**
 * Simple, explainable scoring: length (8+, 12+), mixed case, a digit, a symbol.
 * Under 8 characters is always "Weak" because the API will reject it.
 */
export function passwordStrength(password: string): StrengthResult {
  if (password.length === 0) return { level: 0, label: '', hint: null };

  if (password.length < 8) {
    return { level: 1, label: LABELS[1], hint: `Add ${8 - password.length} more character${8 - password.length === 1 ? '' : 's'}` };
  }

  const checks = [
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const points = checks.filter(Boolean).length;
  const level = (points <= 1 ? 1 : points === 2 ? 2 : points === 3 ? 3 : 4) as StrengthLevel;

  let hint: string | null = null;
  if (level < 4) {
    if (!checks[1]) hint = 'Mix upper and lower case letters';
    else if (!checks[2]) hint = 'Add a number';
    else if (!checks[3]) hint = 'Add a symbol like ! or #';
    else if (!checks[0]) hint = 'Make it 12 or more characters';
  }
  return { level, label: LABELS[level], hint };
}
