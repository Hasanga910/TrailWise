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

export const AVAILABLE_LANGUAGES = [
  'Afrikaans',
  'Albanian',
  'Amharic',
  'Arabic',
  'Armenian',
  'Azerbaijani',
  'Basque',
  'Bengali',
  'Bosnian',
  'Bulgarian',
  'Burmese',
  'Catalan',
  'Chinese',
  'Croatian',
  'Czech',
  'Danish',
  'Dutch',
  'English',
  'Estonian',
  'Filipino',
  'Finnish',
  'French',
  'Georgian',
  'German',
  'Greek',
  'Gujarati',
  'Hebrew',
  'Hindi',
  'Hungarian',
  'Icelandic',
  'Indonesian',
  'Irish',
  'Italian',
  'Japanese',
  'Kannada',
  'Kazakh',
  'Khmer',
  'Korean',
  'Lao',
  'Latvian',
  'Lithuanian',
  'Malay',
  'Malayalam',
  'Marathi',
  'Mongolian',
  'Nepali',
  'Norwegian',
  'Persian',
  'Polish',
  'Portuguese',
  'Punjabi',
  'Romanian',
  'Russian',
  'Serbian',
  'Sinhala',
  'Slovak',
  'Slovenian',
  'Spanish',
  'Swahili',
  'Swedish',
  'Tamil',
  'Telugu',
  'Thai',
  'Turkish',
  'Ukrainian',
  'Urdu',
  'Uzbek',
  'Vietnamese',
  'Welsh',
] as const;

export type AvailableLanguage = (typeof AVAILABLE_LANGUAGES)[number];

export interface GuideProfileDto {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  contactInfo: string;
  languages: string[];
  specializations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateGuideProfileInput {
  name: string;
  email: string;
  contactInfo?: string;
  languages?: string[];
  specializations?: string[];
}

export async function getMyGuideProfile(): Promise<GuideProfileDto> {
  const response = await apiClient.get<GuideProfileDto>('/api/guides/me');
  return response.data;
}

export async function updateMyGuideProfile(input: UpdateGuideProfileInput): Promise<GuideProfileDto> {
  const response = await apiClient.put<GuideProfileDto>('/api/guides/me/profile', input);
  return response.data;
}

export async function deleteMyGuideProfile(): Promise<void> {
  await apiClient.delete('/api/guides/me/profile');
}

