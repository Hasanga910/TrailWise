import type { DashboardRefundExceptionDto } from '../../../api/reports';

export function startsInText(days: number): string {
  if (days < 0) return days === -1 ? 'started yesterday' : `started ${-days} days ago`;
  if (days === 0) return 'starts today';
  if (days === 1) return 'starts tomorrow';
  return `starts in ${days} days`;
}

/** Where a pending cancellation request lives in the approval queue. */
export const refundLink = (item: Pick<DashboardRefundExceptionDto, 'approvalId'>) =>
  `/ops/approvals?type=RefundException&approval=${item.approvalId}`;
