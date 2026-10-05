import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './IconButton';
import { useOverlay } from './useOverlay';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: 'left' | 'right';
  /** Hide the built-in header (the content supplies its own). */
  bare?: boolean;
  className?: string;
}

export function Drawer({ open, onClose, title, children, side = 'right', bare, className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlay(open, onClose, panelRef);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={bare ? title : undefined}
        aria-labelledby={bare ? undefined : titleId}
        tabIndex={-1}
        className={cn(
          'absolute top-0 flex h-full w-[min(22rem,90vw)] flex-col bg-surface-raised shadow-overlay',
          side === 'left' ? 'left-0 border-r border-border' : 'right-0 border-l border-border',
          className,
        )}
      >
        {!bare && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id={titleId} className="font-heading text-h3 text-fg">
              {title}
            </h2>
            <IconButton label="Close panel" size="sm" icon={<X className="h-4 w-4" />} onClick={onClose} />
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
