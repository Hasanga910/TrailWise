import { describe, expect, it } from 'vitest';
import { hasDuplicateTier, sortTiers } from './tierHelpers';

const tier = (classType: 'First' | 'Second' | 'Normal', includesFood: boolean) => ({
  classType,
  includesFood,
  basePricePerPerson: 100,
  requiresAC: false,
});

describe('tier helpers', () => {
  it('treats the same class with different food as different tiers', () => {
    expect(hasDuplicateTier([tier('Normal', false), tier('Normal', true)])).toBe(false);
  });

  it('flags the same class and food option twice', () => {
    expect(hasDuplicateTier([tier('First', true), tier('Normal', false), tier('First', true)])).toBe(true);
  });

  it('sorts cheapest class first, without food before with food', () => {
    const sorted = sortTiers([tier('First', false), tier('Normal', true), tier('Normal', false), tier('Second', false)]);
    expect(sorted.map((t) => `${t.classType}:${t.includesFood}`)).toEqual(['Normal:false', 'Normal:true', 'Second:false', 'First:false']);
  });
});
