import { describe, expect, it } from 'vitest';
import { activeFilterCount, readValues, sortOptionValue, toQuery } from './explorerFilters';

const q = (qs: string) => toQuery(readValues(new URLSearchParams(qs)));

describe('toQuery', () => {
  it('returns an empty query for no filters', () => {
    expect(q('')).toEqual({});
  });

  it('parses every filter', () => {
    expect(q('q=%20ella%20&theme=Beach&minDays=2&maxDays=5&minPrice=50&maxPrice=300&classType=First&guests=4&sort=rating&dir=desc')).toEqual({
      q: 'ella',
      theme: 'Beach',
      minDays: 2,
      maxDays: 5,
      minPrice: 50,
      maxPrice: 300,
      classType: 'First',
      guests: 4,
      sort: 'rating',
      dir: 'desc',
    });
  });

  it('drops invalid values instead of sending them', () => {
    expect(q('minDays=abc&maxPrice=-5&classType=Platinum&guests=0&sort=banana&dir=desc')).toEqual({});
  });

  it('ignores dir without a valid sort', () => {
    expect(q('dir=desc')).toEqual({});
  });

  it('swaps reversed ranges', () => {
    expect(q('minDays=9&maxDays=2')).toEqual({ minDays: 2, maxDays: 9 });
  });

  it('rejects fractional day and guest counts', () => {
    expect(q('minDays=1.5&guests=2.5')).toEqual({});
  });
});

describe('activeFilterCount / sortOptionValue', () => {
  it('counts filters but not sorting', () => {
    expect(activeFilterCount(readValues(new URLSearchParams('q=x&theme=Beach&sort=price&dir=asc')))).toBe(2);
  });

  it('maps URL sort and dir to the select option', () => {
    expect(sortOptionValue({ sort: '', dir: '' })).toBe('default');
    expect(sortOptionValue({ sort: 'price', dir: 'desc' })).toBe('price:desc');
    expect(sortOptionValue({ sort: 'price', dir: '' })).toBe('price:asc');
    expect(sortOptionValue({ sort: 'rating', dir: 'asc' })).toBe('default');
  });
});
