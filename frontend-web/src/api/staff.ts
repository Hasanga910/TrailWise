import { apiClient } from './apiClient';
import type { UserRole } from '../auth/types';

export type StaffRole = 'TourGuide' | 'OperationsManager' | 'FleetCoordinator';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
}

export async function getStaff(): Promise<StaffMember[]> {
  const response = await apiClient.get<StaffMember[]>('/api/auth/admin/users');
  return response.data;
}

export async function createStaffUser(input: CreateStaffInput): Promise<StaffMember> {
  const response = await apiClient.post<StaffMember>('/api/auth/admin/users', input);
  return response.data;
}

export async function deleteStaffUser(id: string): Promise<void> {
  await apiClient.delete(`/api/auth/admin/users/${id}`);
}
