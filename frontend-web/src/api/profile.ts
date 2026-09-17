import { apiClient } from './apiClient';
import type { CurrentUser } from '../auth/types';

export interface UpdateProfileInput {
  name: string;
  email: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function updateProfile(input: UpdateProfileInput): Promise<CurrentUser> {
  const response = await apiClient.put<CurrentUser>('/api/auth/me', input);
  return response.data;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  await apiClient.put('/api/auth/me/password', input);
}
