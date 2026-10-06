import type { ApprovalDecision, ApprovalItemDto } from '../../../api/approvals';

/** Money with cents, for breakdown lines (the catalogue helpers round to whole dollars). */
export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface PriceBreakdown {
  tierBasePrice: number;
  cateringCost: number;
  addOnsCost: number;
  subtotal: number;
  discountDescription: string | null;
  discountPercentage: number;
  groupDiscount: number;
  finalTotal: number;
}

/** The pricing agent stores its breakdown as a JSON string; returns null when it cannot be read. */
export function parseBreakdown(raw: string): PriceBreakdown | null {
  try {
    const value = JSON.parse(raw) as Partial<PriceBreakdown> | null;
    if (!value || typeof value.finalTotal !== 'number' || typeof value.subtotal !== 'number') {
      return null;
    }
    return {
      tierBasePrice: value.tierBasePrice ?? 0,
      cateringCost: value.cateringCost ?? 0,
      addOnsCost: value.addOnsCost ?? 0,
      subtotal: value.subtotal,
      discountDescription: value.discountDescription ?? null,
      discountPercentage: value.discountPercentage ?? 0,
      groupDiscount: value.groupDiscount ?? 0,
      finalTotal: value.finalTotal,
    };
  } catch {
    return null;
  }
}

export const DECISION_LABELS: Record<ApprovalDecision, string> = {
  Approve: 'Approve',
  Reject: 'Reject',
  RequestRevision: 'Request revision',
};

export function noteRequired(decision: ApprovalDecision): boolean {
  return decision !== 'Approve';
}

/** What a decision will do, in plain words, for the confirmation dialog. */
export function describeConsequence(item: ApprovalItemDto, decision: ApprovalDecision): string {
  if (item.type === 'RefundException') {
    const paid = formatMoney(item.refund?.approvedPaymentTotal ?? 0);
    switch (decision) {
      case 'Approve':
        return `The booking is cancelled, its approved payments (${paid}) are marked Refunded, and the guide and vehicle are released. Marking a payment Refunded is a status change only: return the money to the traveler outside the system.`;
      case 'Reject':
        return 'The booking is cancelled without a refund, and the guide and vehicle are released. The note is kept on the approval.';
      case 'RequestRevision':
        return `The cancellation request is closed and the booking returns to ${item.refund?.previousBookingStatus ?? 'its previous status'}. The traveler can see your note and ask again.`;
    }
  }

  switch (decision) {
    case 'Approve':
      return 'The booking is confirmed: the proposed guide and vehicle are assigned and the traveler is notified. Nothing is saved if a guide or vehicle can no longer be reserved.';
    case 'Reject':
      return 'The booking is cancelled and any held resources are released. The note is kept on the approval.';
    case 'RequestRevision':
      return 'The booking goes back to Plan proposed and the traveler can see your note.';
  }
}
