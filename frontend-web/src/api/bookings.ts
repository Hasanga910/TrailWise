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
  status?: BookingStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function createBooking(input: CreateBookingInput): Promise<BookingDto> {
  const response = await apiClient.post<BookingDto>('/api/bookings', input);
  return response.data;
}

export async function getMyBookings(params: GetMyBookingsParams = {}): Promise<PagedResult<BookingDto>> {
  const response = await apiClient.get<PagedResult<BookingDto>>('/api/bookings/mine', { params });
  return response.data;
}

export async function getBookingById(id: string): Promise<BookingDto> {
  const response = await apiClient.get<BookingDto>(`/api/bookings/${id}`);
  return response.data;
}
