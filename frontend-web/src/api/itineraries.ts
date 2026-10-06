import { apiClient } from './apiClient';

export interface ItineraryStepDto {
  id: string;
  bookingId: string;
  dayNumber: number;
  activity: string;
  location: string;
  startTime: string; // 'HH:mm:ss'
}

export interface ItineraryStepInput {
  dayNumber: number;
  activity: string;
  location: string;
  startTime: string; // 'HH:mm:ss' or 'HH:mm'
}

export async function getItinerary(bookingId: string): Promise<ItineraryStepDto[]> {
  const response = await apiClient.get<ItineraryStepDto[]>(`/api/bookings/${bookingId}/itinerary`);
  return response.data;
}

export async function setItinerary(bookingId: string, steps: ItineraryStepInput[]): Promise<ItineraryStepDto[]> {
  const response = await apiClient.post<ItineraryStepDto[]>(`/api/bookings/${bookingId}/itinerary`, { steps });
  return response.data;
}
