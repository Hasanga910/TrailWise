import { ImageOff } from 'lucide-react';
import type { TourPackage } from '../../api/packages';
import { cn } from '../ui/cn';
import { packagePhotoUrl } from './packageSummary';

/** Package photo with a themed placeholder when none has been uploaded. */
export function PackagePhoto({ pkg, className, priority = false }: { pkg: TourPackage; className?: string; priority?: boolean }) {
  const src = packagePhotoUrl(pkg);
  if (!src) {
    return (
      <div
        className={cn('flex items-center justify-center bg-gradient-to-br from-brand-soft to-neutral-soft text-fg-muted', className)}
        role="img"
        aria-label={`${pkg.name} (no photo yet)`}
      >
        <ImageOff className="h-8 w-8" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={pkg.name}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('object-cover', className)}
    />
  );
}
