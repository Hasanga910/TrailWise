import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { searchLocations, type LocationSuggestion } from '../../api/locations';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { isNotOnMap } from './locationCoordinates';

/** Search-as-you-type picker for the places a package visits. */
export function LocationPicker({
  selected,
  onChange,
  notOnMap,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  /** Existing locations the map can't place yet (full map editing arrives with the itinerary builder). */
  notOnMap?: ReadonlySet<string>;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }
    const timeout = setTimeout(() => {
      searchLocations(trimmed)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 600);
    return () => clearTimeout(timeout);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSearching(value.trim().length >= 2);
  }

  function addLocation(name: string) {
    const trimmed = name.trim();
    if (!trimmed || selected.includes(trimmed)) {
      return;
    }
    onChange([...selected, trimmed]);
    setQuery('');
    setSuggestions([]);
  }

  const trimmedQuery = query.trim();
  const visibleSuggestions = trimmedQuery.length >= 2 ? suggestions : [];
  const hasExactMatch = visibleSuggestions.some((s) => s.name.toLowerCase() === trimmedQuery.toLowerCase());
  const optionClass = 'block w-full px-3 py-2 text-left text-body text-fg hover:bg-surface-sunken';

  return (
    <div>
      {selected.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Selected locations">
          {selected.map((name) => (
            <li key={name}>
              <Badge tone="brand" className="gap-1.5 py-1 pr-1.5">
                {name}
                {isNotOnMap(notOnMap, name) && (
                  <Badge tone="warning" title="This place isn't on the public map yet. We retry when the package is saved.">
                    Not on map
                  </Badge>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => onChange(selected.filter((l) => l !== name))}
                  className="rounded-full p-0.5 hover:bg-brand-text/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Input
          aria-label="Search for a location"
          placeholder="Search for a location..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />
        {trimmedQuery.length >= 2 && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-input border border-border bg-surface-raised shadow-raised">
            {searching && <p className="px-3 py-2 text-caption text-fg-muted">Searching...</p>}
            {!searching &&
              visibleSuggestions.map((s) => (
                <button key={s.name} type="button" onClick={() => addLocation(s.name)} className={optionClass}>
                  {s.name}
                </button>
              ))}
            {!searching && !hasExactMatch && (
              <button type="button" onClick={() => addLocation(trimmedQuery)} className={`${optionClass} font-semibold text-brand-text`}>
                Add &quot;{trimmedQuery}&quot; as typed
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
