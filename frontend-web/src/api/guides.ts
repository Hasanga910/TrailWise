import { apiClient } from './apiClient';

export interface GuideDto {
  id: string;
  name: string;
  languages: string[];
  specializations: string[];
  contactInfo: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuideRequest {
  name: string;
  languages: string[];
  specializations: string[];
  contactInfo: string;
  userId?: string | null;
}

export interface UpdateGuideRequest {
  name: string;
  languages: string[];
  specializations: string[];
  contactInfo: string;
  userId?: string | null;
}

export interface GuideAvailabilityDto {
  id: string;
  guideId: string;
  date: string; // 'YYYY-MM-DD'
  isAvailable: boolean;
  assignedBookingId: string | null;
}

export interface GuideAvailabilityItemRequest {
  date: string; // 'YYYY-MM-DD'
  isAvailable: boolean;
}

export interface UpdateGuideAvailabilityRequest {
  dates: GuideAvailabilityItemRequest[];
}

export interface AssignedTourDto {
  bookingId: string;
  startDate: string;
  endDate: string;
  groupSize: number;
  status: string;
  tourPackageId: string;
  tourPackageName: string;
  theme: string;
  locations: string[];
  specialRequests?: string | null;
  guideId: string;
  guideName: string;
  attended: boolean;
  completed: boolean;
  guideNotes?: string | null;
}

export interface UpdateGuideTourRequest {
  attended: boolean;
  completed: boolean;
  notes?: string | null;
}

export async function getGuides(specialization?: string, language?: string): Promise<GuideDto[]> {
  const params: Record<string, string> = {};
  if (specialization) params.specialization = specialization;
  if (language) params.language = language;
  const response = await apiClient.get<GuideDto[]>('/api/guides', { params });
  return response.data;
}

export async function getGuideById(id: string): Promise<GuideDto> {
  const response = await apiClient.get<GuideDto>(`/api/guides/${id}`);
  return response.data;
}

export async function createGuide(request: CreateGuideRequest): Promise<GuideDto> {
  const response = await apiClient.post<GuideDto>('/api/guides', request);
  return response.data;
}

export async function updateGuide(id: string, request: UpdateGuideRequest): Promise<GuideDto> {
  const response = await apiClient.put<GuideDto>(`/api/guides/${id}`, request);
  return response.data;
}

export async function getGuideAvailability(
  guideId: string,
  from?: string,
  to?: string,
): Promise<GuideAvailabilityDto[]> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const response = await apiClient.get<GuideAvailabilityDto[]>(`/api/guides/${guideId}/availability`, { params });
  return response.data;
}

export async function updateGuideAvailability(
  guideId: string,
  request: UpdateGuideAvailabilityRequest,
): Promise<GuideAvailabilityDto[]> {
  const response = await apiClient.put<GuideAvailabilityDto[]>(`/api/guides/${guideId}/availability`, request);
  return response.data;
}

export async function getAssignedTours(): Promise<AssignedTourDto[]> {
  const response = await apiClient.get<AssignedTourDto[]>('/api/guides/me/assigned-tours');
  return response.data;
}

export async function updateGuideTour(
  bookingId: string,
  request: UpdateGuideTourRequest,
): Promise<AssignedTourDto> {
  const response = await apiClient.patch<AssignedTourDto>(`/api/bookings/${bookingId}/guide-notes`, request);
  return response.data;
}
