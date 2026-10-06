import { describe, expect, it } from 'vitest';
import type { TourPackage } from '../../api/packages';
import { bookingTarget, locationSummary, plottable, ratingDistribution, shortLocationName, startingPrice, tierClasses } from './packageSummary';

const base: TourPackage = {
  id: 'p',
  name: 'P',
  theme: 'T',
  durationDays: 1,
  basePricePerPerson: 500,
  maxGroupSize: 5,
  photoUrl: null,
  tiers: [],
  locations: [],
};

describe('packageSummary', () => {
  it('uses the API starting price, else the cheapest tier, else the base price', () => {
    expect(startingPrice({ ...base, startingPrice: 90 })).toBe(90);
    expect(
      startingPrice({
        ...base,
        tiers: [
          { id: 'a', classType: 'First', includesFood: true, basePricePerPerson: 300, requiresAC: true },
          { id: 'b', classType: 'Normal', includesFood: false, basePricePerPerson: 120, requiresAC: false },
        ],
      }),
    ).toBe(120);
    expect(startingPrice(base)).toBe(500);
  });

  it('lists tier classes cheapest-class first without duplicates', () => {
    const tier = (id: string, classType: 'First' | 'Second' | 'Normal') => ({ id, classType, includesFood: false, basePricePerPerson: 1, requiresAC: false });
    expect(tierClasses({ ...base, tiers: [tier('1', 'First'), tier('2', 'Normal'), tier('3', 'First')] })).toEqual(['Normal', 'First']);
  });

  it('summarises locations', () => {
    const locations = ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({ id: String(i), name }));
    expect(locationSummary({ ...base, locations }, 3)).toEqual({ shown: ['A', 'B', 'C'], more: 2, full: 'A · B · C · D · E' });
  });

  it('shows only the place name before the first comma, keeping the full text for the tooltip', () => {
    expect(shortLocationName('Kandy, Central Province, Sri Lanka')).toBe('Kandy');
    expect(shortLocationName('  Ella  ')).toBe('Ella');
    expect(shortLocationName(', Galle')).toBe(', Galle');
    const locations = [{ id: '1', name: 'Sigiriya, Central Province' }, { id: '2', name: 'Galle' }];
    expect(locationSummary({ ...base, locations })).toEqual({
      shown: ['Sigiriya', 'Galle'],
      more: 0,
      full: 'Sigiriya, Central Province · Galle',
    });
  });

  it('numbers stops by their position in the full route and drops unplaced ones', () => {
    const points = plottable([
      { id: '1', name: 'A', latitude: 1, longitude: 2 },
      { id: '2', name: 'B', latitude: null, longitude: null },
      { id: '3', name: 'C', latitude: 3, longitude: 4 },
      { id: '4', name: 'D', latitude: 5 },
    ]);
    expect(points.map((p) => [p.number, p.name])).toEqual([[1, 'A'], [3, 'C']]);
  });

  it('counts ratings per star', () => {
    expect(ratingDistribution([{ rating: 5 }, { rating: 5 }, { rating: 3 }, { rating: 1 }, { rating: 9 }])).toEqual([1, 0, 1, 0, 2]);
  });

  it('builds a safe booking target', () => {
    expect(bookingTarget('t1')).toBe('/traveler/bookings/new?tier=t1');
    expect(bookingTarget('t1', '4', '2030-01-02')).toBe('/traveler/bookings/new?tier=t1&guests=4&start=2030-01-02');
    expect(bookingTarget('t1', 'x', '<script>')).toBe('/traveler/bookings/new?tier=t1');
  });
});
