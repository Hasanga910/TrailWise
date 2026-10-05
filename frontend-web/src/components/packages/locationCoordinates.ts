import type { PackageInput, TourPackage } from '../../api/packages';

const key = (name: string) => name.trim().toLowerCase();

/**
 * Coordinates to send back when a package is edited, so an edit never drops them. Only names that are
 * still in the form are sent (the API rejects coordinates for a name that is no longer listed).
 */
export function coordinatesForSubmit(pkg: TourPackage | undefined, names: string[]): PackageInput['locationCoordinates'] {
  if (!pkg) return undefined;
  const wanted = new Set(names.map(key));
  const seen = new Set<string>();
  const coordinates: NonNullable<PackageInput['locationCoordinates']> = [];
  for (const location of pkg.locations) {
    const k = key(location.name);
    if (!wanted.has(k) || seen.has(k)) continue;
    if (typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      seen.add(k);
      coordinates.push({ name: location.name.trim(), latitude: location.latitude, longitude: location.longitude });
    }
  }
  return coordinates.length > 0 ? coordinates : undefined;
}

/** Lower-cased names of the package's existing locations that have no coordinates yet. */
export function namesNotOnMap(pkg: TourPackage | undefined): ReadonlySet<string> {
  const missing = new Set<string>();
  for (const location of pkg?.locations ?? []) {
    if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') missing.add(key(location.name));
  }
  return missing;
}

export const isNotOnMap = (set: ReadonlySet<string> | undefined, name: string) => set?.has(key(name)) ?? false;
