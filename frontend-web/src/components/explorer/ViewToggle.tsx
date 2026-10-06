import { LayoutGrid, List } from 'lucide-react';
import { cn } from '../ui/cn';

export type ExplorerView = 'grid' | 'list';

export function ViewToggle({ value, onChange }: { value: ExplorerView; onChange: (view: ExplorerView) => void }) {
  const options = [
    { view: 'grid' as const, label: 'Grid view', Icon: LayoutGrid },
    { view: 'list' as const, label: 'List view', Icon: List },
  ];
  return (
    <div role="group" aria-label="Layout" className="inline-flex rounded-input border border-border bg-surface-raised p-0.5">
      {options.map(({ view, label, Icon }) => (
        <button
          key={view}
          type="button"
          aria-pressed={value === view}
          aria-label={label}
          title={label}
          onClick={() => onChange(view)}
          className={cn(
            'inline-flex h-8 w-9 items-center justify-center rounded-lg transition',
            value === view ? 'bg-brand-soft text-brand-fg' : 'text-fg-muted hover:text-fg',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
