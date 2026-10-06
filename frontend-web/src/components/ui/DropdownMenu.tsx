import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** When defined, the item is a radio-style choice and shows a check when true. */
  selected?: boolean;
}

export type MenuEntry = MenuItem | 'separator' | { heading: string };

export interface DropdownMenuProps {
  /** Render prop for the trigger; spread `props` onto a button. */
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
  }) => ReactNode;
  items: MenuEntry[];
  /** Optional free content above the items (e.g. a user summary). */
  header?: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

export function DropdownMenu({ trigger, items, header, align = 'end', className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus();
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? []);
    const idx = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nodes[(idx + 1) % nodes.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nodes[(idx - 1 + nodes.length) % nodes.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      nodes[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      nodes[nodes.length - 1]?.focus();
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': menuId,
      })}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          onKeyDown={onKeyDown}
          className={cn(
            'animate-page-in absolute z-40 mt-2 min-w-56 rounded-card border border-border bg-surface-raised p-1.5 shadow-raised',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {header}
          {items.map((entry, i) => {
            if (entry === 'separator') return <div key={i} role="separator" className="my-1 h-px bg-border" />;
            if ('heading' in entry)
              return (
                <p key={i} className="px-3 pb-1 pt-2 text-overline text-fg-muted">
                  {entry.heading}
                </p>
              );
            return (
              <button
                key={i}
                type="button"
                role={entry.selected === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={entry.selected}
                disabled={entry.disabled}
                onClick={() => {
                  close(false);
                  entry.onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-input px-3 py-2 text-left text-body font-medium transition disabled:opacity-50',
                  entry.tone === 'danger' ? 'text-danger hover:bg-danger-soft' : 'text-fg hover:bg-surface-sunken',
                )}
              >
                {entry.icon}
                <span className="flex-1">{entry.label}</span>
                {entry.selected && <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
