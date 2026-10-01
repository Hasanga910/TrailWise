import type { UserRole } from './types';

export function getHomeRouteForRole(role: UserRole): string {
  switch (role) {
    case 'Admin':
      return '/admin';
    case 'OperationsManager':
      return '/ops';
    case 'Traveler':
      return '/traveler';
    case 'FleetCoordinator':
      return '/fleet';
    case 'Driver':
      return '/driver/dashboard';
    case 'TourGuide':
    default:
      return '/portal';
  }
}
