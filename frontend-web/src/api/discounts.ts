import { apiClient } from './apiClient';

export interface DiscountDto {
  id: string;
  description: string;
  percentageOff: number;
  minGroupSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiscountRequest {
  description: string;
  percentageOff: number;
  minGroupSize: number;
}

export async function getDiscounts(): Promise<DiscountDto[]> {
  const response = await apiClient.get<DiscountDto[]>('/api/discounts');
  return response.data;
}

export async function createDiscount(request: CreateDiscountRequest): Promise<DiscountDto> {
  const response = await apiClient.post<DiscountDto>('/api/discounts', request);
  return response.data;
}

export async function deleteDiscount(id: string): Promise<void> {
  await apiClient.delete(`/api/discounts/${id}`);
}
