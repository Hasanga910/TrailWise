/** Whole-dollar price, e.g. "$1,250". Prices in the catalogue are per person. */
export function formatPrice(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
