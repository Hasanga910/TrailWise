import { apiClient } from './apiClient';

export interface LocationSuggestion {
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export async function searchLocations(query: string): Promise<LocationSuggestion[]> {
  const response = await apiClient.get<LocationSuggestion[]>('/api/locations/search', {
    params: { query },
  });
  return response.data;
}
