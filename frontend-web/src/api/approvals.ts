import { apiClient } from './apiClient';
import type { ApprovalType, BookingDto } from './bookings';

export type ApprovalClassType = 'First' | 'Second' | 'Normal';

export type { ApprovalType };

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'RevisionRequested' | 'Superseded';
export type ApprovalDecision = 'Approve' | 'Reject' | 'RequestRevision';

/** Stable display order for the three approval types (design doc 8.3). */
export const APPROVAL_TYPES: ApprovalType[] = ['LargeGroupOrCustomItinerary', 'BudgetOverride', 'RefundException'];

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  LargeGroupOrCustomItinerary: 'Large group / custom itinerary',
  BudgetOverride: 'Budget override',
  RefundException: 'Cancellation / refund exception',
};

export interface ApprovalCountsDto {
  largeGroupOrCustomItinerary: number;
  budgetOverride: number;
  refundException: number;
  total: number;
}

export interface ApprovalBookingDto {
  travelerName: string;
  tourPackageName: string;
  classType: ApprovalClassType;
  includesFood: boolean;
  requiresAc: boolean;
  groupSize: number;
  startDate: string;
  endDate: string;
  budgetPerPerson: number;
  specialRequests: string | null;
  languagePreference: string | null;
}

export interface GuideEvidenceDto {
  guideId: string | null;
  name: string | null;
  matchScore: number;
  reasoning: string;
}

export interface VehicleEvidenceDto {
  vehicleId: string | null;
  registrationNumber: string | null;
  type: string | null;
  capacity: number | null;
  hasAc: boolean | null;
  seatConfiguration: string | null;
  driverId: string | null;
  driverName: string | null;
  acMatch: boolean;
  seatConfigMatch: boolean;
  conflictCheck: boolean;
}

export interface PricingEvidenceDto {
  totalCost: number;
  /** JSON string produced by the pricing agent (tier price, catering, add-ons, discount, total). */
  breakdown: string;
  validationResult: string;
  totalBudget: number;
  budgetCeiling: number;
}

export interface ValidationEvidenceDto {
  decision: string;
  reasons: string[];
}

export interface ApprovalEvidenceDto {
  guide: GuideEvidenceDto | null;
  vehicle: VehicleEvidenceDto | null;
  pricing: PricingEvidenceDto | null;
  validation: ValidationEvidenceDto | null;
  summaryText: string | null;
  advisoryFlags: string[];
}

export interface RefundPaymentDto {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  submittedAt: string;
}

export interface RefundEvidenceDto {
  daysUntilStart: number;
  windowDays: number;
  travelerReason: string | null;
  previousBookingStatus: string | null;
  approvedPaymentTotal: number;
  payments: RefundPaymentDto[];
}

export interface ApprovalItemDto {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  bookingId: string;
  requestedAt: string;
  reasons: string[];
  booking: ApprovalBookingDto;
  evidence: ApprovalEvidenceDto;
  workflowRunId: string | null;
  refund: RefundEvidenceDto | null;
}

export interface PendingApprovalsDto {
  counts: ApprovalCountsDto;
  items: ApprovalItemDto[];
}

export interface ApprovalDecidedDto {
  id: string;
  status: ApprovalStatus;
  booking: BookingDto;
}

export async function getPendingApprovals(type?: ApprovalType): Promise<PendingApprovalsDto> {
  const response = await apiClient.get<PendingApprovalsDto>('/api/approvals/pending', {
    params: { type: type || undefined },
  });
  return response.data;
}

/** A note is required by the API when rejecting or requesting a revision. */
export async function decideApproval(
  id: string,
  decision: ApprovalDecision,
  note?: string,
): Promise<ApprovalDecidedDto> {
  const response = await apiClient.post<ApprovalDecidedDto>(`/api/approvals/${id}/decide`, {
    decision,
    note: note?.trim() || undefined,
  });
  return response.data;
}

export function countForType(counts: ApprovalCountsDto, type: ApprovalType): number {
  switch (type) {
    case 'LargeGroupOrCustomItinerary':
      return counts.largeGroupOrCustomItinerary;
    case 'BudgetOverride':
      return counts.budgetOverride;
    case 'RefundException':
      return counts.refundException;
  }
}
