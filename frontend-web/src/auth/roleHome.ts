import type { UserRole } from './types';

export function getHomeRouteForRole(role: UserRole): string {
  switch (role) {
    case 'Admin':
      return '/admin';
    case 'OperationsManager':
      return '/ops';
    case 'Traveler':
      return '/traveler';
    case 'TourGuide':
    case 'FleetCoordinator':
    default:
      return '/portal';
  }
}
