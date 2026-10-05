import { API_BASE_URL } from '../../api/apiClient';
import type { ClassType, PackageLocation, TourPackage } from '../../api/packages';

export function packagePhotoUrl(pkg: Pick<TourPackage, 'photoUrl'>): string | null {
  return pkg.photoUrl ? `${API_BASE_URL}${pkg.photoUrl}` : null;
}

const CLASS_ORDER: ClassType[] = ['Normal', 'Second', 'First'];

export function startingPrice(pkg: TourPackage): number {
  if (pkg.startingPrice !== undefined) return pkg.startingPrice;
  return pkg.tiers.length > 0 ? Math.min(...pkg.tiers.map((t) => t.basePricePerPerson)) : pkg.basePricePerPerson;
}

export function tierClasses(pkg: TourPackage): ClassType[] {
  const present = new Set(pkg.tiers.map((t) => t.classType));
  return CLASS_ORDER.filter((c) => present.has(c));
}

export function locationSummary(pkg: TourPackage, max = 3): { shown: string[]; more: number } {
  const names = pkg.locations.map((l) => l.name);
  return { shown: names.slice(0, max), more: Math.max(0, names.length - max) };
}

export interface MapPoint {
  /** 1-based stop number, matches the list beside the map. */
  number: number;
  name: string;
  latitude: number;
  longitude: number;
}

/** Locations that have coordinates, numbered by their position in the full route. */
export function plottable(locations: PackageLocation[]): MapPoint[] {
  return locations.flatMap((l, i) =>
    typeof l.latitude === 'number' && typeof l.longitude === 'number'
      ? [{ number: i + 1, name: l.name, latitude: l.latitude, longitude: l.longitude }]
      : [],
  );
}

/** Counts per star; index 0 is one star and index 4 is five stars. */
export function ratingDistribution(reviews: { rating: number }[]): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const r of reviews) {
    if (r.rating >= 1 && r.rating <= 5) counts[Math.round(r.rating) - 1]++;
  }
  return counts;
}

/** Where a signed-in traveler books: the existing request form, tier preselected. */
export function bookingTarget(tierId: string, guests?: string | null, start?: string | null): string {
  const params = new URLSearchParams({ tier: tierId });
  if (guests && /^\d+$/.test(guests)) params.set('guests', guests);
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) params.set('start', start);
  return `/traveler/bookings/new?${params.toString()}`;
}
