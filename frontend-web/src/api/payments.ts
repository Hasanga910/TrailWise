import { apiClient } from './apiClient';

export interface PendingPaymentDto {
  id: string;
  bookingId: string;
  travelerName: string | null;
  travelerEmail: string | null;
  packageName: string | null;
  amount: number;
  bankSlipUrl: string;
  submittedAt: string;
  status: string;
  paymentDueAt?: string | null;
  balancePaymentDueAt?: string | null;
}

export interface PaymentDto {
  id: string;
  bookingId: string;
  amount: number;
  method: string;
  bankSlipUrl: string;
  submittedAt: string;
  paidAt: string | null;
  status: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface RejectPaymentRequest {
  reason: string;
}

export async function getPendingPayments(): Promise<PendingPaymentDto[]> {
  const response = await apiClient.get<PendingPaymentDto[]>('/api/payments/pending');
  return response.data;
}

export async function getPaymentById(id: string): Promise<PaymentDto> {
  const response = await apiClient.get<PaymentDto>(`/api/payments/${id}`);
  return response.data;
}

export async function approvePayment(id: string): Promise<PaymentDto> {
  const response = await apiClient.post<PaymentDto>(`/api/payments/${id}/approve`);
  return response.data;
}

export async function rejectPayment(id: string, reason: string): Promise<PaymentDto> {
  const response = await apiClient.post<PaymentDto>(`/api/payments/${id}/reject`, { reason });
  return response.data;
}

export async function getPaymentSlipBlob(paymentId: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(`/api/payments/${paymentId}/slip`, {
    responseType: 'blob',
  });
  return response.data;
}
