import { cn } from './cn';

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
} as const;

export interface AvatarProps {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  /** Optional photo; falls back to initials. */
  src?: string;
  className?: string;
}

export function Avatar({ name, size = 'md', src, className }: AvatarProps) {
  if (src) {
    return <img src={src} alt={name} className={cn('shrink-0 rounded-full object-cover', SIZE_CLASSES[size], className)} />;
  }
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 font-heading font-bold text-white shadow-soft',
        SIZE_CLASSES[size],
        className,
      )}
    >
      {initialsFor(name)}
    </div>
  );
}
