import { apiClient } from './apiClient';
import type { BookingStatus } from './bookings';

export interface AssignedTourDto {
  bookingId: string;
  startDate: string;
  endDate: string;
  groupSize: number;
  status: BookingStatus;
  tourPackageId: string;
  tourPackageName: string;
  theme: string;
  locations: string[];
  specialRequests: string | null;
  guideId: string;
  guideName: string;
  attended: boolean;
  completed: boolean;
  guideNotes: string | null;
  tourStartedAt?: string | null;
  tourEndedAt?: string | null;
}

export interface UpdateGuideTourInput {
  attended: boolean;
  completed?: boolean;
  notes?: string | null;
}

export async function getMyAssignedTours(): Promise<AssignedTourDto[]> {
  const response = await apiClient.get<AssignedTourDto[]>('/api/guides/me/assigned-tours');
  return response.data;
}

export async function updateGuideTour(bookingId: string, input: UpdateGuideTourInput): Promise<AssignedTourDto> {
  const response = await apiClient.patch<AssignedTourDto>(`/api/bookings/${bookingId}/guide-notes`, input);
  return response.data;
}

