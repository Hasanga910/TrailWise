export type UserRole = 'Traveler' | 'TourGuide' | 'OperationsManager' | 'FleetCoordinator' | 'Admin';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: CurrentUser;
}
