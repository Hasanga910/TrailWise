import type { ReactNode } from 'react';
import { Compass } from 'lucide-react';
import { cn } from './cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-fg">
        {icon ?? <Compass className="h-8 w-8" aria-hidden />}
      </div>
      <h3 className="font-heading text-h4 text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-body text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
