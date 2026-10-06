import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  approvePayment,
  getPaymentById,
  getPaymentSlipBlob,
  getPendingPayments,
  rejectPayment,
  type PaymentDto,
  type PendingPaymentDto,
} from '../../api/payments';
import { notify } from '../../components/ui/notify';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}

function isPdfUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf');
}

export function OpsPaymentsPage() {
  const [payments, setPayments] = useState<PendingPaymentDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected payment for viewing details / review modal
  const [selectedPayment, setSelectedPayment] = useState<PendingPaymentDto | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<PaymentDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Authenticated bank slip blob preview state
  const [slipBlobUrl, setSlipBlobUrl] = useState<string | null>(null);
  const [loadingSlip, setLoadingSlip] = useState(false);
  const [slipError, setSlipError] = useState<string | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  // Approval modal state
  const [approvingPayment, setApprovingPayment] = useState<PendingPaymentDto | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Rejection modal state
  const [rejectingPayment, setRejectingPayment] = useState<PendingPaymentDto | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionValidationError, setRejectionValidationError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const safeSetSlipBlobUrl = useCallback((url: string | null) => {
    if (activeBlobUrlRef.current && activeBlobUrlRef.current !== url) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
    }
    activeBlobUrlRef.current = url;
    setSlipBlobUrl(url);
  }, []);

  // Cleanup active blob URL on component unmount
  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  const fetchSlipBlob = useCallback(
    async (paymentId: string) => {
      setLoadingSlip(true);
      setSlipError(null);
      try {
        const blob = await getPaymentSlipBlob(paymentId);
        const url = URL.createObjectURL(blob);
        safeSetSlipBlobUrl(url);
      } catch (err) {
        safeSetSlipBlobUrl(null);
        setSlipError(extractErrorMessage(err, 'Failed to load bank slip file.'));
      } finally {
        setLoadingSlip(false);
      }
    },
    [safeSetSlipBlobUrl],
  );

  useEffect(() => {
    if (selectedPayment) {
      fetchSlipBlob(selectedPayment.id);
    } else {
      safeSetSlipBlobUrl(null);
      setSlipError(null);
      setLoadingSlip(false);
    }
  }, [selectedPayment?.id, fetchSlipBlob, safeSetSlipBlobUrl]);

  const loadPendingPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPendingPayments();
      setPayments(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load pending payments.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPendingPayments()
      .then((data) => {
        if (!cancelled) {
          setPayments(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(extractErrorMessage(err, 'Failed to load pending payments.'));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenReview = async (item: PendingPaymentDto) => {
    setSelectedPayment(item);
    setPaymentDetail(null);
    setLoadingDetail(true);
    try {
      const detail = await getPaymentById(item.id);
      setPaymentDetail(detail);
    } catch {
      // Fallback: we still have PendingPaymentDto to render
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApprove = async () => {
    if (!approvingPayment) return;
    setIsApproving(true);
    try {
      const res = await approvePayment(approvingPayment.id);
      const resultingStatus = res.status;
      setPayments((prev) => (prev ? prev.filter((p) => p.id !== approvingPayment.id) : null));
      notify.success(`Payment of ${currencyFormatter.format(approvingPayment.amount)} approved successfully (${resultingStatus}).`,);
      setApprovingPayment(null);
      if (selectedPayment?.id === approvingPayment.id) {
        setSelectedPayment(null);
      }
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Failed to approve payment.'));
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPayment) return;

    const trimmed = rejectionReason.trim();
    if (!trimmed) {
      setRejectionValidationError('Rejection reason is required.');
      return;
    }
    if (trimmed.length > 500) {
      setRejectionValidationError('Rejection reason cannot exceed 500 characters.');
      return;
    }

    setIsRejecting(true);
    setRejectionValidationError(null);
    try {
      await rejectPayment(rejectingPayment.id, trimmed);
      setPayments((prev) => (prev ? prev.filter((p) => p.id !== rejectingPayment.id) : null));
      notify.success(`Payment of ${currencyFormatter.format(rejectingPayment.amount)} rejected.`);
      setRejectingPayment(null);
      setRejectionReason('');
      if (selectedPayment?.id === rejectingPayment.id) {
        setSelectedPayment(null);
      }
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Failed to reject payment.'));
    } finally {
      setIsRejecting(false);
    }
  };

  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    if (!searchQuery.trim()) return payments;
    const q = searchQuery.toLowerCase().trim();
    return payments.filter(
      (p) =>
        (p.travelerName && p.travelerName.toLowerCase().includes(q)) ||
        (p.travelerEmail && p.travelerEmail.toLowerCase().includes(q)) ||
        (p.packageName && p.packageName.toLowerCase().includes(q)) ||
        p.bookingId.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [payments, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-xl font-bold text-fg">Payment Verification</h2>
            {payments && payments.length > 0 && (
              <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-fg">
                {payments.length} Pending
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            Review and verify traveler bank transfer payment slips.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPendingPayments}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3.5 py-2 text-sm font-semibold text-fg shadow-xs transition hover:bg-surface-sunken disabled:opacity-60"
          >
            <svg
              className={`h-4 w-4 ${loading ? 'animate-spin text-brand-text' : 'text-fg-muted'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 21h5v-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}

      {/* Search Bar */}
      {payments && payments.length > 0 && (
        <div className="max-w-md">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by traveler, package, booking ID..."
              className="w-full rounded-xl border border-border bg-surface-raised px-4 py-2.5 pl-10 text-sm text-fg placeholder:text-fg-muted/70 shadow-xs transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <svg
              className="absolute left-3.5 top-3 h-4 w-4 text-fg-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-fg-muted hover:text-fg-muted"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && payments === null && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-surface-raised" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-6 text-center shadow-xs">
          <p className="font-semibold text-danger-fg">{error}</p>
          <button
            type="button"
            onClick={loadPendingPayments}
            className="mt-3 inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && payments !== null && payments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface-raised px-6 py-16 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-soft text-fg-muted mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7">
              <rect x="2.5" y="5" width="19" height="14" rx="2" strokeLinejoin="round" />
              <path d="M2.5 10h19" strokeLinecap="round" />
              <path d="M6.5 15h3M13.5 15h4" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="font-heading text-base font-bold text-fg">
            No bank transfer payments are awaiting verification.
          </h3>
          <p className="mt-1 text-sm text-fg-muted max-w-sm mx-auto">
            When travelers upload bank transfer slips for their tour bookings, they will appear here for verification.
          </p>
          <button
            type="button"
            onClick={loadPendingPayments}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-fg shadow-xs transition hover:bg-surface-sunken"
          >
            Check for new payments
          </button>
        </div>
      )}

      {/* Filtered Empty State */}
      {!loading && !error && payments !== null && payments.length > 0 && filteredPayments.length === 0 && (
        <div className="rounded-xl border border-border bg-surface-raised p-8 text-center text-sm text-fg-muted shadow-xs">
          No pending payments match &quot;{searchQuery}&quot;.
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="ml-2 font-semibold text-brand-text hover:text-brand-text underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Pending Payments Table / Cards */}
      {!error && filteredPayments.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken/80 text-left text-xs font-semibold uppercase tracking-wider text-fg-muted">
                  <th className="px-5 py-3.5">Traveler</th>
                  <th className="px-5 py-3.5">Package</th>
                  <th className="px-5 py-3.5">Booking ID</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Submitted At</th>
                  <th className="px-5 py-3.5">Payment Due</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPayments.map((item) => {
                  const isSubmittedOnTime =
                    item.paymentDueAt && new Date(item.submittedAt) <= new Date(item.paymentDueAt);

                  return (
                    <tr key={item.id} className="transition hover:bg-surface-sunken/80">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-fg">
                          {item.travelerName || 'Unknown Traveler'}
                        </div>
                        {item.travelerEmail && (
                          <div className="text-xs text-fg-muted">{item.travelerEmail}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-fg font-medium">
                        {item.packageName || 'Custom Itinerary'}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-fg-muted" title={item.bookingId}>
                        {item.bookingId.slice(0, 8)}...
                      </td>
                      <td className="px-5 py-4 font-bold text-fg">
                        {currencyFormatter.format(item.amount)}
                      </td>
                      <td className="px-5 py-4 text-xs text-fg-muted whitespace-nowrap">
                        <div>{formatDateTime(item.submittedAt)}</div>
                        {isSubmittedOnTime && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success-fg border border-success/30">
                            ✓ Submitted On Time
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-fg-muted whitespace-nowrap">
                        {item.paymentDueAt ? formatDateTime(item.paymentDueAt) : '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-fg">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Pending Verification
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenReview(item)}
                            className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-fg shadow-2xs transition hover:bg-surface-sunken"
                          >
                            Review Payment
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenReview(item)}
                            className="rounded-lg border border-border bg-surface-sunken px-2.5 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-neutral-soft"
                            title="Open bank slip in review modal"
                          >
                            Slip ↗
                          </button>
                          <button
                            type="button"
                            onClick={() => setApprovingPayment(item)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingPayment(item);
                              setRejectionReason('');
                              setRejectionValidationError(null);
                            }}
                            className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger-fg transition hover:bg-danger-soft"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Payment Detail / Review Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-surface-raised shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="font-heading text-lg font-bold text-fg">
                  Bank Transfer Payment Review
                </h3>
                <p className="text-xs text-fg-muted">
                  Verify the transfer receipt against the requested tour booking.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="rounded-lg p-1.5 text-fg-muted hover:bg-neutral-soft hover:text-fg-muted"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Payment Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border bg-surface-sunken/60 p-4">
                <div>
                  <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                    Transferred Amount
                  </span>
                  <div className="text-2xl font-extrabold text-fg mt-0.5">
                    {currencyFormatter.format(selectedPayment.amount)}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                    Payment Method
                  </span>
                  <div className="text-sm font-semibold text-fg mt-1">
                    {paymentDetail?.method || 'Bank Transfer'}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                    Traveler
                  </span>
                  <div className="text-sm font-semibold text-fg mt-0.5">
                    {selectedPayment.travelerName || 'Unknown Traveler'}
                  </div>
                  {selectedPayment.travelerEmail && (
                    <div className="text-xs text-fg-muted">{selectedPayment.travelerEmail}</div>
                  )}
                </div>

                <div>
                  <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                    Tour Package
                  </span>
                  <div className="text-sm font-semibold text-fg mt-0.5">
                    {selectedPayment.packageName || 'Custom Itinerary'}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                    Payment ID
                  </span>
                  <div className="text-xs font-mono text-fg mt-0.5 break-all select-all">
                    {paymentDetail?.id || selectedPayment.id}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                    Booking ID
                  </span>
                  <div className="text-xs font-mono text-fg mt-0.5 break-all select-all">
                    {selectedPayment.bookingId}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                    Submitted Time
                  </span>
                  <div className="text-xs text-fg mt-0.5">
                    {formatDateTime(paymentDetail?.submittedAt || selectedPayment.submittedAt)}
                  </div>
                  {selectedPayment.paymentDueAt &&
                    new Date(paymentDetail?.submittedAt || selectedPayment.submittedAt) <=
                      new Date(selectedPayment.paymentDueAt) && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success-fg border border-success/30">
                        ✓ Submitted On Time
                      </span>
                    )}
                </div>

                {selectedPayment.paymentDueAt && (
                  <div>
                    <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                      Payment Due At
                    </span>
                    <div className="text-xs text-fg mt-0.5">
                      {formatDateTime(selectedPayment.paymentDueAt)}
                    </div>
                  </div>
                )}
              </div>

              {/* Bank Slip Preview Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-fg">Bank Transfer Slip Receipt</h4>
                  {slipBlobUrl && (
                    <a
                      href={slipBlobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-brand-text hover:text-brand-text underline inline-flex items-center gap-1"
                    >
                      Open Full Receipt ↗
                    </a>
                  )}
                </div>

                {loadingSlip ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-sunken p-8 text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent mb-2" />
                    <span className="text-xs text-fg-muted">Loading bank slip receipt securely...</span>
                  </div>
                ) : slipError ? (
                  <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-6 text-center">
                    <p className="text-sm font-semibold text-danger-fg">{slipError}</p>
                    <button
                      type="button"
                      onClick={() => fetchSlipBlob(selectedPayment.id)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-surface-raised px-3 py-1.5 text-xs font-semibold text-danger-fg shadow-2xs hover:bg-danger-soft"
                    >
                      Retry Loading Slip
                    </button>
                  </div>
                ) : isPdfUrl(selectedPayment.bankSlipUrl) ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-sunken p-8 text-center">
                    <svg className="h-12 w-12 text-danger mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span className="text-sm font-semibold text-fg">
                      PDF Document Attached
                    </span>
                    <p className="text-xs text-fg-muted mt-1 max-w-xs">
                      The traveler submitted a PDF bank receipt. Click below to view the full PDF document in your browser.
                    </p>
                    {slipBlobUrl && (
                      <a
                        href={slipBlobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-fg px-4 py-2 text-xs font-semibold text-surface shadow-xs transition hover:bg-fg/90"
                      >
                        View PDF Document
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border bg-neutral-soft flex items-center justify-center p-2">
                    {slipBlobUrl && (
                      <img
                        src={slipBlobUrl}
                        alt="Bank transfer slip"
                        className="max-h-80 w-auto rounded-lg object-contain shadow-xs"
                      />
                    )}
                  </div>
                )}
              </div>

              {loadingDetail && (
                <div className="text-center text-xs text-fg-muted py-2">
                  Refreshing latest payment details...
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border bg-surface-sunken px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-fg shadow-2xs hover:bg-surface-sunken"
              >
                Close
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingPayment(selectedPayment);
                    setRejectionReason('');
                    setRejectionValidationError(null);
                  }}
                  className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-2 text-sm font-semibold text-danger-fg shadow-2xs hover:bg-danger-soft"
                >
                  Reject Payment
                </button>
                <button
                  type="button"
                  onClick={() => setApprovingPayment(selectedPayment)}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-2xs transition hover:bg-emerald-700"
                >
                  Approve Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Approve Confirmation Dialog */}
      {approvingPayment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-success shrink-0">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-fg">
                  Approve Payment?
                </h3>
                <p className="text-xs text-fg-muted">
                  Confirm verification of this bank transfer.
                </p>
              </div>
            </div>

            <p className="text-sm text-fg-muted mt-2">
              Approve this bank transfer payment of{' '}
              <strong className="font-bold text-fg">
                {currencyFormatter.format(approvingPayment.amount)}
              </strong>{' '}
              for booking{' '}
              <span className="font-mono text-xs font-semibold text-fg">
                {approvingPayment.bookingId.slice(0, 8)}...
              </span>
              ?
            </p>

            <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setApprovingPayment(null)}
                disabled={isApproving}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-sunken"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {isApproving ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Reject Payment Dialog */}
      {rejectingPayment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div role="alert" className="flex h-8 w-8 items-center justify-center rounded-full bg-danger-soft text-danger shrink-0">
                  ✕
                </div>
                <h3 className="font-heading text-lg font-bold text-fg">
                  Reject Payment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingPayment(null)}
                disabled={isRejecting}
                className="text-fg-muted hover:text-fg-muted"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-fg-muted mb-3">
              Rejecting payment of{' '}
              <strong className="text-fg">
                {currencyFormatter.format(rejectingPayment.amount)}
              </strong>
              . Please provide a clear explanation for the traveler.
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label
                  htmlFor="rejection-reason"
                  className="block text-xs font-semibold uppercase tracking-wider text-fg mb-1"
                >
                  Rejection Reason <span className="text-danger">*</span>
                </label>
                <textarea
                  id="rejection-reason"
                  rows={4}
                  required
                  maxLength={500}
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (rejectionValidationError) setRejectionValidationError(null);
                  }}
                  placeholder="e.g. Receipt image is blurry and unreadable, or transfer amount does not match."
                  className="w-full rounded-xl border border-border bg-surface-raised p-3 text-sm text-fg placeholder:text-fg-muted/70 focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/20"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-fg-muted">
                  <span>{rejectionValidationError && <span className="text-danger font-medium">{rejectionValidationError}</span>}</span>
                  <span>{rejectionReason.length} / 500</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setRejectingPayment(null)}
                  disabled={isRejecting}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejecting || !rejectionReason.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-red-700 disabled:opacity-60"
                >
                  {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
