import { apiClient } from './apiClient';
import type { PackageTier } from './packages';

export type BookingStatus =
  | 'Requested'
  | 'PlanProposed'
  | 'PendingApproval'
  | 'Confirmed'
  | 'Completed'
  | 'Cancelled'
  | 'NeedsManualReview';

export interface CreateBookingInput {
  packageTierId: string;
  groupSize: number;
  startDate: string;
  endDate: string;
  budgetPerPerson: number;
  specialRequests?: string;
}

export interface BookingDto {
  id: string;
  travelerId: string;
  tourPackageId: string;
  tourPackageName: string;
  packageTier: PackageTier;
  groupSize: number;
  startDate: string;
  endDate: string;
  budgetPerPerson: number;
  specialRequests?: string | null;
  status: BookingStatus;
  isLargeGroup: boolean;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface GetMyBookingsParams {
  status?: BookingStatus | 'Pending';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface BookingSummaryDto {
  id: string;
  travelerName: string;
  packageName: string;
  status: BookingStatus;
  createdAt: string;
  startDate: string;
  groupSize: number;
}

export async function createBooking(input: CreateBookingInput): Promise<BookingDto> {
  const response = await apiClient.post<BookingDto>('/api/bookings', input);
  return response.data;
}

export async function getMyBookings(params: GetMyBookingsParams = {}): Promise<PagedResult<BookingDto>> {
  const response = await apiClient.get<PagedResult<BookingDto>>('/api/bookings/mine', { params });
  return response.data;
}

export async function getPagedBookings(params: GetMyBookingsParams = {}): Promise<PagedResult<BookingDto>> {
  const response = await apiClient.get<PagedResult<BookingDto>>('/api/bookings/paged', { params });
  return response.data;
}

export async function getBookingById(id: string): Promise<BookingDto> {
  const response = await apiClient.get<BookingDto>(`/api/bookings/${id}`);
  return response.data;
}

export async function getAllBookings(): Promise<BookingSummaryDto[]> {
  const response = await apiClient.get<BookingSummaryDto[]>('/api/bookings');
  return response.data;
}

export type BookingDecision = 'Approve' | 'Reject';

export interface DecideBookingInput {
  decision: BookingDecision;
  notes?: string;
}

export async function decideBooking(id: string, input: DecideBookingInput): Promise<BookingDto> {
  const response = await apiClient.patch<BookingDto>(`/api/bookings/${id}/decision`, input);
  return response.data;
}

export async function completeBooking(id: string): Promise<BookingDto> {
  const response = await apiClient.patch<BookingDto>(`/api/bookings/${id}/complete`, {});
  return response.data;
}

export async function cancelBooking(id: string, reason?: string): Promise<BookingDto> {
  const response = await apiClient.patch<BookingDto>(`/api/bookings/${id}/cancel`, { reason });
  return response.data;
}
