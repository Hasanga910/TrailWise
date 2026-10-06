import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { AVAILABLE_LANGUAGES } from '../../api/guides';
import { Badge, Input, cn } from '../ui';

interface LanguagePickerProps {
  languages: string[];
  error: string | null;
  onSelect: (language: string) => void;
  onRemove: (language: string) => void;
}

/** Selected-language chips plus a searchable combobox of the languages a guide can offer. */
export function LanguagePicker({ languages, error, onSelect, onRemove }: LanguagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmedSearch = search.trim().toLowerCase();
  const filtered = AVAILABLE_LANGUAGES.filter((lang) => !trimmedSearch || lang.toLowerCase().includes(trimmedSearch));
  const isSelected = (lang: string) => languages.some((l) => l.toLowerCase() === lang.toLowerCase());

  function select(lang: string) {
    onSelect(lang);
    setSearch('');
    setIsOpen(false);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2" data-testid="language-chips">
        {languages.map((lang) => (
          <Badge key={lang} tone="brand" className="gap-1.5 py-1 pr-1.5">
            <span>{lang}</span>
            <button
              type="button"
              aria-label={`Remove ${lang}`}
              onClick={() => onRemove(lang)}
              className="rounded-full p-0.5 hover:bg-brand-text/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </Badge>
        ))}
        {languages.length === 0 && <span className="text-caption italic text-fg-muted">No languages selected yet.</span>}
      </div>

      <div ref={pickerRef} className="relative">
        <div className="relative">
          <Input
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-label="Search languages..."
            placeholder="Search languages..."
            className="pr-9"
            value={search}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsOpen(false);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered.length > 0) {
                  select(filtered.find((l) => !isSelected(l)) ?? filtered[0]);
                }
              }
            }}
          />
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
            aria-hidden
          />
        </div>

        {isOpen && (
          <div
            role="listbox"
            data-testid="language-dropdown"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-input border border-border bg-surface-raised py-1 shadow-raised focus:outline-none"
          >
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-center text-caption text-fg-muted">No languages found</div>
            ) : (
              filtered.map((lang) => {
                const selected = isSelected(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={selected}
                    onClick={() => select(lang)}
                    className={cn(
                      'flex w-full items-center justify-between px-4 py-2 text-left text-body transition',
                      selected
                        ? 'cursor-not-allowed bg-surface-sunken text-fg-muted'
                        : 'cursor-pointer text-fg hover:bg-brand-soft hover:text-brand-fg',
                    )}
                  >
                    <span>{lang}</span>
                    {selected && <span className="text-caption font-medium text-brand-text">Selected</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-caption font-medium text-danger-fg">{error}</p>}
    </div>
  );
}
