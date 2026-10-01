import { apiClient } from './apiClient';

export interface DiscountDto {
  id: string;
  description: string;
  percentageOff: number;
  minGroupSize: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiscountRequest {
  description: string;
  percentageOff: number;
  minGroupSize: number;
  isActive?: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface UpdateDiscountRequest {
  description: string;
  percentageOff: number;
  minGroupSize: number;
  isActive: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface ToggleDiscountActiveRequest {
  isActive: boolean;
}

export async function getDiscounts(): Promise<DiscountDto[]> {
  const response = await apiClient.get<DiscountDto[]>('/api/discounts');
  return response.data;
}

export async function getDiscount(id: string): Promise<DiscountDto> {
  const response = await apiClient.get<DiscountDto>(`/api/discounts/${id}`);
  return response.data;
}

export async function createDiscount(request: CreateDiscountRequest): Promise<DiscountDto> {
  const response = await apiClient.post<DiscountDto>('/api/discounts', request);
  return response.data;
}

export async function updateDiscount(id: string, request: UpdateDiscountRequest): Promise<DiscountDto> {
  const response = await apiClient.put<DiscountDto>(`/api/discounts/${id}`, request);
  return response.data;
}

export async function toggleDiscountActive(id: string, isActive: boolean): Promise<DiscountDto> {
  const response = await apiClient.patch<DiscountDto>(`/api/discounts/${id}/active`, { isActive });
  return response.data;
}

export async function deleteDiscount(id: string): Promise<void> {
  await apiClient.delete(`/api/discounts/${id}`);
}
