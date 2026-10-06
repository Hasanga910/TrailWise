import { beforeEach, describe, expect, it } from 'vitest';
import { clearReturnTo, pickReturnTo, readReturnTo, resolvePostAuthRoute, sanitizeReturnTo, saveReturnTo } from './returnTo';
import type { UserRole } from './types';

const as = (role: UserRole) => ({ role });

describe('sanitizeReturnTo', () => {
  it('accepts in-app paths with query strings', () => {
    expect(sanitizeReturnTo('/traveler/bookings/new?tier=1&guests=2')).toBe('/traveler/bookings/new?tier=1&guests=2');
  });

  it.each([
    ['absolute URL', 'https://evil.example/steal'],
    ['protocol-relative URL', '//evil.example'],
    ['no leading slash', 'traveler'],
    ['backslash trick', '/\\evil.example'],
    ['control character', '/ok\nbad'],
    ['login loop', '/login'],
    ['register loop with query', '/register?x=1'],
    ['empty', ''],
    ['non-string', 42],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(sanitizeReturnTo(value)).toBeNull();
  });

  it('does not reject paths that merely start with the letters of an auth page', () => {
    expect(sanitizeReturnTo('/registered-offers')).toBe('/registered-offers');
  });
});

describe('session backup', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips and clears', () => {
    saveReturnTo('/traveler/bookings/new?tier=9');
    expect(readReturnTo()).toBe('/traveler/bookings/new?tier=9');
    clearReturnTo();
    expect(readReturnTo()).toBeNull();
  });

  it('never stores unsafe values', () => {
    saveReturnTo('//evil.example');
    expect(readReturnTo()).toBeNull();
  });

  it('prefers router state over the stored value', () => {
    saveReturnTo('/traveler/packages');
    expect(pickReturnTo('/traveler/bookings')).toBe('/traveler/bookings');
    expect(pickReturnTo(undefined)).toBe('/traveler/packages');
  });
});

describe('resolvePostAuthRoute', () => {
  it('follows the saved path when it is inside the role portal', () => {
    expect(resolvePostAuthRoute(as('Traveler'), '/traveler/bookings/new?tier=1')).toBe('/traveler/bookings/new?tier=1');
  });

  it('falls back to the role home for another portal, unsafe or missing paths', () => {
    expect(resolvePostAuthRoute(as('Traveler'), '/ops/payments')).toBe('/traveler');
    expect(resolvePostAuthRoute(as('Traveler'), 'https://evil.example')).toBe('/traveler');
    expect(resolvePostAuthRoute(as('Traveler'), undefined)).toBe('/traveler');
    expect(resolvePostAuthRoute(as('OperationsManager'), '/traveler/bookings')).toBe('/ops');
  });

  it('does not treat a longer sibling path as inside the portal', () => {
    expect(resolvePostAuthRoute(as('Traveler'), '/traveler-evil/x')).toBe('/traveler');
  });
});
