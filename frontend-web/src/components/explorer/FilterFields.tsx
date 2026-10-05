import type { PackageFacets } from '../../api/packages';
import { cn } from '../ui/cn';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { CLASS_TYPES, SORT_OPTIONS, sortOptionValue, type ExplorerValues, type FilterKey } from './explorerFilters';

export interface FilterFieldsProps {
  values: ExplorerValues;
  facets: PackageFacets | null;
  onChange: (key: FilterKey, value: string) => void;
  onSortChange: (sort: string, dir: string) => void;
  /** Hide the search box where the page already shows one. */
  hideSearch?: boolean;
  idPrefix?: string;
}

/** The filter form body, shared by the desktop sidebar and the mobile drawer. */
export function FilterFields({ values, facets, onChange, onSortChange, hideSearch, idPrefix = 'filter' }: FilterFieldsProps) {
  const themes = facets?.themes ?? [];
  return (
    <div className="space-y-5">
      {!hideSearch && (
        <Input
          id={`${idPrefix}-q`}
          label="Search"
          type="search"
          placeholder="Place, theme or tour name"
          value={values.q}
          onChange={(e) => onChange('q', e.target.value)}
        />
      )}

      {themes.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-caption font-semibold text-fg">Theme</legend>
          <div className="flex flex-wrap gap-2">
            {['', ...themes].map((theme) => {
              const selected = values.theme.toLowerCase() === theme.toLowerCase();
              return (
                <button
                  key={theme || 'all'}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange('theme', theme)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-caption font-semibold transition',
                    selected
                      ? 'border-brand-500 bg-brand-soft text-brand-fg'
                      : 'border-border bg-surface-raised text-fg-muted hover:text-fg',
                  )}
                >
                  {theme || 'All'}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-1.5 text-caption font-semibold text-fg">Duration (days)</legend>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id={`${idPrefix}-minDays`}
            aria-label="Minimum days"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder={facets ? String(facets.minDays) : 'Min'}
            value={values.minDays}
            onChange={(e) => onChange('minDays', e.target.value)}
          />
          <Input
            id={`${idPrefix}-maxDays`}
            aria-label="Maximum days"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder={facets ? String(facets.maxDays) : 'Max'}
            value={values.maxDays}
            onChange={(e) => onChange('maxDays', e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-caption font-semibold text-fg">Price per person ($)</legend>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id={`${idPrefix}-minPrice`}
            aria-label="Minimum price"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={facets ? String(Math.floor(facets.minPrice)) : 'Min'}
            value={values.minPrice}
            onChange={(e) => onChange('minPrice', e.target.value)}
          />
          <Input
            id={`${idPrefix}-maxPrice`}
            aria-label="Maximum price"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={facets ? String(Math.ceil(facets.maxPrice)) : 'Max'}
            value={values.maxPrice}
            onChange={(e) => onChange('maxPrice', e.target.value)}
          />
        </div>
      </fieldset>

      <Select
        id={`${idPrefix}-classType`}
        label="Class"
        value={values.classType}
        onChange={(e) => onChange('classType', e.target.value)}
      >
        <option value="">Any class</option>
        {CLASS_TYPES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>

      <Input
        id={`${idPrefix}-guests`}
        label="Travelers"
        type="number"
        min={1}
        inputMode="numeric"
        placeholder="Group size"
        hint="Only tours that fit your group"
        value={values.guests}
        onChange={(e) => onChange('guests', e.target.value)}
      />

      <Select
        id={`${idPrefix}-sort`}
        label="Sort by"
        value={sortOptionValue(values)}
        onChange={(e) => {
          const option = SORT_OPTIONS.find((o) => o.value === e.target.value);
          if (option) onSortChange(option.sort, option.dir);
        }}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
