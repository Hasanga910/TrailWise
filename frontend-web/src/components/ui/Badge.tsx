import type { HTMLAttributes } from 'react';
import { cn } from './cn';
import { BADGE_TONES, type BadgeTone } from './badgeStyles';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-semibold',
        BADGE_TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}
