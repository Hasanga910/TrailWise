import type { ClassType, PackageQuery, PackageSort, SortDirection } from '../../api/packages';

/** Raw (string) URL values for every filter, so inputs can be edited freely while typing. */
export interface ExplorerValues {
  q: string;
  theme: string;
  minDays: string;
  maxDays: string;
  minPrice: string;
  maxPrice: string;
  classType: string;
  guests: string;
  sort: string;
  dir: string;
}

export const FILTER_KEYS = ['q', 'theme', 'minDays', 'maxDays', 'minPrice', 'maxPrice', 'classType', 'guests', 'sort', 'dir'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** Keys that count as "a filter" (everything except sorting). */
const FILTERING_KEYS: FilterKey[] = ['q', 'theme', 'minDays', 'maxDays', 'minPrice', 'maxPrice', 'classType', 'guests'];

export const CLASS_TYPES: ClassType[] = ['First', 'Second', 'Normal'];
const SORTS: PackageSort[] = ['name', 'price', 'duration', 'rating'];

export function readValues(params: URLSearchParams): ExplorerValues {
  const get = (key: FilterKey) => params.get(key) ?? '';
  return {
    q: get('q'),
    theme: get('theme'),
    minDays: get('minDays'),
    maxDays: get('maxDays'),
    minPrice: get('minPrice'),
    maxPrice: get('maxPrice'),
    classType: get('classType'),
    guests: get('guests'),
    sort: get('sort'),
    dir: get('dir'),
  };
}

function positiveNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function positiveInt(value: string): number | undefined {
  const n = positiveNumber(value);
  return n !== undefined && Number.isInteger(n) ? n : undefined;
}

/** Turns raw URL values into a backend query. Invalid or empty values are dropped rather than sent. */
export function toQuery(values: ExplorerValues): PackageQuery {
  const minDays = positiveInt(values.minDays);
  const maxDays = positiveInt(values.maxDays);
  const minPrice = positiveNumber(values.minPrice);
  const maxPrice = positiveNumber(values.maxPrice);
  const sort = SORTS.includes(values.sort as PackageSort) ? (values.sort as PackageSort) : undefined;
  const dir: SortDirection | undefined = values.dir === 'asc' || values.dir === 'desc' ? values.dir : undefined;
  const guests = positiveInt(values.guests);

  const query: PackageQuery = {
    q: values.q.trim() || undefined,
    theme: values.theme || undefined,
    // A range typed backwards would be a 400 from the API: swap instead of failing.
    minDays: minDays !== undefined && maxDays !== undefined ? Math.min(minDays, maxDays) : minDays,
    maxDays: minDays !== undefined && maxDays !== undefined ? Math.max(minDays, maxDays) : maxDays,
    minPrice: minPrice !== undefined && maxPrice !== undefined ? Math.min(minPrice, maxPrice) : minPrice,
    maxPrice: minPrice !== undefined && maxPrice !== undefined ? Math.max(minPrice, maxPrice) : maxPrice,
    classType: CLASS_TYPES.includes(values.classType as ClassType) ? (values.classType as ClassType) : undefined,
    guests: guests && guests > 0 ? guests : undefined,
    sort,
    dir: sort ? dir : undefined,
  };

  return Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)) as PackageQuery;
}

export function activeFilterCount(values: ExplorerValues): number {
  return FILTERING_KEYS.filter((key) => values[key].trim() !== '').length;
}

export interface SortOption {
  value: string;
  label: string;
  sort: string;
  dir: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: 'default', label: 'Recommended', sort: '', dir: '' },
  { value: 'price:asc', label: 'Price: low to high', sort: 'price', dir: 'asc' },
  { value: 'price:desc', label: 'Price: high to low', sort: 'price', dir: 'desc' },
  { value: 'duration:asc', label: 'Duration: shortest first', sort: 'duration', dir: 'asc' },
  { value: 'duration:desc', label: 'Duration: longest first', sort: 'duration', dir: 'desc' },
  { value: 'rating:desc', label: 'Top rated', sort: 'rating', dir: 'desc' },
  { value: 'name:asc', label: 'Name: A to Z', sort: 'name', dir: 'asc' },
];

export function sortOptionValue(values: Pick<ExplorerValues, 'sort' | 'dir'>): string {
  if (!values.sort) return 'default';
  const match = SORT_OPTIONS.find((o) => o.sort === values.sort && o.dir === (values.dir || 'asc'));
  return match?.value ?? 'default';
}
