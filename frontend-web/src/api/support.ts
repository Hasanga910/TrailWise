import { apiClient } from './apiClient';

export type TicketCategory = 'Trip' | 'Payment' | 'Booking' | 'Account' | 'App' | 'Other';
export type TicketStatus = 'Open' | 'InProgress' | 'WaitingForCustomer' | 'Resolved' | 'Closed';
export type TicketPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export interface SupportTicketListDto {
  id: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  bookingId: string | null;
  packageName: string | null;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessageDto {
  id: string;
  senderId: string;
  senderDisplayName: string;
  isStaff: boolean;
  message: string;
  createdAt: string;
}

export interface SupportTicketDetailDto {
  id: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  travelerId: string;
  travelerDisplayName: string;
  bookingId: string | null;
  packageName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  messages: SupportMessageDto[];
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface SupportFilterParams {
  status?: string;
  category?: string;
  priority?: string;
  assignedToId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getSupportTickets(
  params?: SupportFilterParams,
): Promise<PagedResult<SupportTicketListDto>> {
  const response = await apiClient.get<PagedResult<SupportTicketListDto>>(
    '/api/staff/support/tickets',
    { params },
  );
  return response.data;
}

export async function getSupportTicket(id: string): Promise<SupportTicketDetailDto> {
  const response = await apiClient.get<SupportTicketDetailDto>(
    `/api/staff/support/tickets/${id}`,
  );
  return response.data;
}

export async function sendSupportReply(
  id: string,
  message: string,
): Promise<SupportMessageDto> {
  const response = await apiClient.post<SupportMessageDto>(
    `/api/staff/support/tickets/${id}/messages`,
    { message },
  );
  return response.data;
}

export async function updateSupportStatus(
  id: string,
  status: TicketStatus,
): Promise<SupportTicketDetailDto> {
  const response = await apiClient.patch<SupportTicketDetailDto>(
    `/api/staff/support/tickets/${id}/status`,
    { status },
  );
  return response.data;
}

export async function assignSupportTicket(
  id: string,
  assignedToId: string | null,
): Promise<SupportTicketDetailDto> {
  const response = await apiClient.patch<SupportTicketDetailDto>(
    `/api/staff/support/tickets/${id}/assign`,
    { assignedToId },
  );
  return response.data;
}

export async function updateSupportPriority(
  id: string,
  priority: TicketPriority,
): Promise<SupportTicketDetailDto> {
  const response = await apiClient.patch<SupportTicketDetailDto>(
    `/api/staff/support/tickets/${id}/priority`,
    { priority },
  );
  return response.data;
}
