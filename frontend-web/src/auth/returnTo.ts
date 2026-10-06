import { getHomeRouteForRole } from './roleHome';
import type { CurrentUser, UserRole } from './types';

const STORAGE_KEY = 'trailwise_return_to';

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

/**
 * Accepts only same-origin, in-app paths. Rejects absolute URLs, protocol-relative `//host`,
 * backslashes, control characters and the auth pages themselves (avoids open redirects and loops).
 */
export function sanitizeReturnTo(path: unknown): string | null {
  if (typeof path !== 'string') return null;
  const value = path.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || hasControlCharacter(value)) return null;
  if (/^\/(login|register)(?:[/?#]|$)/.test(value)) return null;
  return value;
}

/** Remember where the visitor was heading, in case router state is lost (refresh, switching auth pages). */
export function saveReturnTo(path: string): void {
  const safe = sanitizeReturnTo(path);
  if (!safe) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, safe);
  } catch {
    // storage unavailable: router state still carries the intent
  }
}

export function readReturnTo(): string | null {
  try {
    return sanitizeReturnTo(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Router state first, then the sessionStorage backup. */
export function pickReturnTo(stateFrom: unknown): string | null {
  return sanitizeReturnTo(stateFrom) ?? readReturnTo();
}

const PORTAL_PREFIX: Record<UserRole, string> = {
  Traveler: '/traveler',
  Admin: '/admin',
  OperationsManager: '/ops',
  FleetCoordinator: '/fleet',
  Driver: '/driver',
  TourGuide: '/guides',
};

/** Follow the saved destination only when it lives in the user's own portal; otherwise use the role home. */
export function resolvePostAuthRoute(user: Pick<CurrentUser, 'role'>, from: unknown): string {
  const safe = sanitizeReturnTo(from);
  const prefix = PORTAL_PREFIX[user.role];
  if (safe && (safe === prefix || safe.startsWith(`${prefix}/`) || safe.startsWith(`${prefix}?`))) {
    return safe;
  }
  return getHomeRouteForRole(user.role);
}
