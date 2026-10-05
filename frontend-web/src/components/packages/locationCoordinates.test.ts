import { describe, expect, it } from 'vitest';
import type { TourPackage } from '../../api/packages';
import { coordinatesForSubmit, isNotOnMap, namesNotOnMap } from './locationCoordinates';

const pkg = {
  id: 'p',
  name: 'P',
  theme: 'T',
  durationDays: 1,
  basePricePerPerson: 1,
  maxGroupSize: 1,
  photoUrl: null,
  tiers: [],
  locations: [
    { id: '1', name: 'Kandy', latitude: 7.29, longitude: 80.63 },
    { id: '2', name: ' Atlantis ', latitude: null, longitude: null },
    { id: '3', name: 'Ella' },
  ],
} satisfies TourPackage;

describe('coordinatesForSubmit', () => {
  it('returns existing coordinates only for names still listed, matching case-insensitively', () => {
    expect(coordinatesForSubmit(pkg, ['kandy', 'Atlantis'])).toEqual([{ name: 'Kandy', latitude: 7.29, longitude: 80.63 }]);
  });

  it('omits coordinates for removed or renamed locations', () => {
    expect(coordinatesForSubmit(pkg, ['Kandy City'])).toBeUndefined();
  });

  it('returns undefined when there is nothing to send', () => {
    expect(coordinatesForSubmit(undefined, ['Kandy'])).toBeUndefined();
    expect(coordinatesForSubmit({ ...pkg, locations: [] }, ['Kandy'])).toBeUndefined();
  });
});

describe('namesNotOnMap', () => {
  it('lists locations without coordinates, trimmed and lower-cased', () => {
    const missing = namesNotOnMap(pkg);
    expect([...missing].sort()).toEqual(['atlantis', 'ella']);
    expect(isNotOnMap(missing, ' ATLANTIS')).toBe(true);
    expect(isNotOnMap(missing, 'Kandy')).toBe(false);
    expect(isNotOnMap(undefined, 'Kandy')).toBe(false);
  });
});
