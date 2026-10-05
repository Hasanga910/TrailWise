export type BadgeTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'orange' | 'neutral';

export const BADGE_TONES: Record<BadgeTone, string> = {
  brand: 'bg-brand-soft text-brand-fg',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  info: 'bg-info-soft text-info-fg',
  orange: 'bg-orange-soft text-orange-fg',
  neutral: 'bg-neutral-soft text-neutral-fg',
};

