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

export interface AssignedGuideDto {
  id: string;
  name: string;
  contactInfo?: string | null;
  languages: string[];
  specializations: string[];
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
  languagePreference?: string | null;
  assignedGuide?: AssignedGuideDto | null;
  hasReview?: boolean;
  paymentStatus?: string | null;
  remainingAmount?: number | null;
  isFullyPaid?: boolean;
  hasPendingPayment?: boolean;
  createdAt?: string;
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
  endDate?: string;
  groupSize: number;
  languagePreference?: string | null;
}

export interface AvailableGuideDto {
  guideId: string;
  name: string;
  languages: string[];
  specializations: string[];
  contactInfo: string;
  matchesSpecialization: boolean;
  matchesLanguage: boolean;
  notes?: string | null;
}

export interface AssignGuideResponse {
  bookingId: string;
  guideId: string;
  status: BookingStatus;
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
  vehicleId?: string;
  driverId?: string;
  guideId?: string;
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

export async function getAvailableGuidesForBooking(bookingId: string): Promise<AvailableGuideDto[]> {
  const response = await apiClient.get<AvailableGuideDto[]>(`/api/bookings/${bookingId}/available-guides`);
  return response.data;
}

export async function assignGuide(bookingId: string, guideId: string): Promise<AssignGuideResponse> {
  const response = await apiClient.post<AssignGuideResponse>(`/api/bookings/${bookingId}/assign-guide`, {
    guideId,
  });
  return response.data;
}

