import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approvePayment,
  getPaymentById,
  getPaymentSlipBlob,
  getPendingPayments,
  rejectPayment,
  type PaymentDto,
  type PendingPaymentDto,
} from '../../api/payments';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { RequireRole } from '../../auth/RequireRole';
import type { UserRole } from '../../auth/types';
import { OpsPaymentsPage } from './OpsPaymentsPage';

vi.mock('../../api/payments', () => ({
  getPendingPayments: vi.fn(),
  getPaymentById: vi.fn(),
  approvePayment: vi.fn(),
  rejectPayment: vi.fn(),
  getPaymentSlipBlob: vi.fn(),
}));

const mockedGetPendingPayments = vi.mocked(getPendingPayments);
const mockedGetPaymentById = vi.mocked(getPaymentById);
const mockedApprovePayment = vi.mocked(approvePayment);
const mockedRejectPayment = vi.mocked(rejectPayment);
const mockedGetPaymentSlipBlob = vi.mocked(getPaymentSlipBlob);

function samplePendingPayment(overrides: Partial<PendingPaymentDto> = {}): PendingPaymentDto {
  return {
    id: 'pay-001',
    bookingId: 'book-1234-5678',
    travelerName: 'Sarah Traveler',
    travelerEmail: 'sarah@example.com',
    packageName: 'Cultural Odyssey',
    amount: 350.0,
    bankSlipUrl: '/uploads/slips/slip-001.jpg',
    submittedAt: '2026-09-29T10:30:00Z',
    status: 'Pending',
    ...overrides,
  };
}

function samplePaymentDetail(overrides: Partial<PaymentDto> = {}): PaymentDto {
  return {
    id: 'pay-001',
    bookingId: 'book-1234-5678',
    amount: 350.0,
    method: 'BankTransfer',
    bankSlipUrl: '/uploads/slips/slip-001.jpg',
    submittedAt: '2026-09-29T10:30:00Z',
    paidAt: null,
    status: 'Pending',
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    createdAt: '2026-09-29T10:30:00Z',
    ...overrides,
  };
}

function renderPaymentsPage() {
  return render(
    <MemoryRouter>
      <OpsPaymentsPage />
    </MemoryRouter>,
  );
}

function renderAppWithAuth(initialPath: string, role: UserRole) {
  const authValue: AuthContextValue = {
    user: {
      id: 'user-1',
      name: 'Test Staff',
      email: 'staff@example.com',
      contactNumber: '+1234567890',
      role,
    },
    status: 'authenticated',
    error: null,
    login: async () => true,
    register: async () => true,
    logout: () => {},
    updateUser: () => {},
  };

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route
            path="/ops/payments"
            element={
              <RequireRole allowedRoles={['OperationsManager', 'Admin']}>
                <OpsPaymentsPage />
              </RequireRole>
            }
          />
          <Route path="/traveler" element={<div>Traveler Dashboard Fallback</div>} />
          <Route path="/login" element={<div>Login Page Fallback</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('OpsPaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:5173/mock-blob-url');
    window.URL.revokeObjectURL = vi.fn();
    mockedGetPaymentSlipBlob.mockResolvedValue(new Blob(['mock-slip-bytes'], { type: 'image/jpeg' }));
  });

  // 1. Pending payments load successfully
  it('loads and displays pending payments', async () => {
    mockedGetPendingPayments.mockResolvedValue([samplePendingPayment()]);

    renderPaymentsPage();

    expect(await screen.findByText('Sarah Traveler')).toBeInTheDocument();
    expect(screen.getByText('Cultural Odyssey')).toBeInTheDocument();
    expect(screen.getByText('$350.00')).toBeInTheDocument();
    expect(screen.getByText('Pending Verification')).toBeInTheDocument();
  });

  // 2. Loading state
  it('shows loading skeleton while fetching pending payments', () => {
    mockedGetPendingPayments.mockReturnValue(new Promise(() => {}));

    const { container } = renderPaymentsPage();

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // 3. Empty state
  it('shows empty state when no pending payments exist', async () => {
    mockedGetPendingPayments.mockResolvedValue([]);

    renderPaymentsPage();

    expect(
      await screen.findByText('No bank transfer payments are awaiting verification.'),
    ).toBeInTheDocument();
  });

  // 4. API error state
  it('shows API error state with retry button', async () => {
    mockedGetPendingPayments.mockRejectedValue(new Error('Network connection failed'));

    renderPaymentsPage();

    expect(await screen.findByText(/failed to load pending payments/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // 5. Pending payment information renders
  it('renders detailed traveler, booking, and package information', async () => {
    const item = samplePendingPayment({
      travelerName: 'David Miller',
      travelerEmail: 'david@example.com',
      packageName: 'Highland Tea Trails',
      bookingId: 'd3f4-12345678-uuid',
      amount: 600.0,
    });
    mockedGetPendingPayments.mockResolvedValue([item]);

    renderPaymentsPage();

    expect(await screen.findByText('David Miller')).toBeInTheDocument();
    expect(screen.getByText('david@example.com')).toBeInTheDocument();
    expect(screen.getByText('Highland Tea Trails')).toBeInTheDocument();
    expect(screen.getByText('$600.00')).toBeInTheDocument();
    expect(screen.getByTitle('d3f4-12345678-uuid')).toBeInTheDocument();
  });

  // 6. Bank slip action renders
  it('renders bank slip action and opens review modal with receipt image', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment();
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedGetPaymentById.mockResolvedValue(samplePaymentDetail());

    renderPaymentsPage();

    expect(await screen.findByRole('button', { name: /slip/i })).toBeInTheDocument();

    // Click Review Payment to open detail modal
    const reviewBtn = screen.getByRole('button', { name: /review payment/i });
    await user.click(reviewBtn);

    expect(screen.getByText('Bank Transfer Payment Review')).toBeInTheDocument();
    expect(mockedGetPaymentSlipBlob).toHaveBeenCalledWith('pay-001');
    const previewImg = await screen.findByAltText('Bank transfer slip');
    expect(previewImg).toHaveAttribute('src', 'blob:http://localhost:5173/mock-blob-url');
  });

  // 7. Approve calls correct endpoint
  it('opens approval confirmation and calls approvePayment on confirm', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment({ id: 'pay-approve-123', amount: 500 });
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedApprovePayment.mockResolvedValue(samplePaymentDetail({ status: 'FullyPaid' }));

    renderPaymentsPage();

    expect(await screen.findByText('Sarah Traveler')).toBeInTheDocument();

    // Click quick Approve button
    const approveBtn = screen.getByRole('button', { name: /^approve$/i });
    await user.click(approveBtn);

    // Confirmation dialog should appear
    expect(screen.getByText(/Approve this bank transfer payment of/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /confirm approval/i });
    await user.click(confirmBtn);

    expect(mockedApprovePayment).toHaveBeenCalledWith('pay-approve-123');
  });

  // 8. Successful approval removes item / refreshes list
  it('removes approved item and shows success banner', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment({ id: 'pay-approve-456' });
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedApprovePayment.mockResolvedValue(samplePaymentDetail({ status: 'DepositPaid' }));

    renderPaymentsPage();

    expect(await screen.findByText('Sarah Traveler')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => {
      expect(screen.queryByText('Sarah Traveler')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/approved successfully \(DepositPaid\)/i)).toBeInTheDocument();
  });

  // 9. Reject modal requires reason
  it('requires a rejection reason in the rejection modal', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment({ id: 'pay-reject-123' });
    mockedGetPendingPayments.mockResolvedValue([item]);

    renderPaymentsPage();

    expect(await screen.findByText('Sarah Traveler')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^reject$/i }));

    expect(screen.getByText('Reject Payment')).toBeInTheDocument();

    const confirmRejectBtn = screen.getByRole('button', { name: /confirm rejection/i });
    expect(confirmRejectBtn).toBeDisabled();

    // Type and clear to test validation
    const textarea = screen.getByLabelText(/rejection reason/i);
    await user.type(textarea, '   ');
    expect(confirmRejectBtn).toBeDisabled();
  });

  // 10. Reject sends reason to correct endpoint
  it('calls rejectPayment with entered reason', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment({ id: 'pay-reject-789' });
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedRejectPayment.mockResolvedValue(samplePaymentDetail({ status: 'Failed' }));

    renderPaymentsPage();

    expect(await screen.findByText('Sarah Traveler')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^reject$/i }));

    const textarea = screen.getByLabelText(/rejection reason/i);
    await user.type(textarea, 'Slip image is completely unreadable.');

    const confirmRejectBtn = screen.getByRole('button', { name: /confirm rejection/i });
    expect(confirmRejectBtn).not.toBeDisabled();
    await user.click(confirmRejectBtn);

    expect(mockedRejectPayment).toHaveBeenCalledWith(
      'pay-reject-789',
      'Slip image is completely unreadable.',
    );
  });

  // 11. Successful rejection removes item / refreshes list
  it('removes rejected item and shows success banner', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment({ id: 'pay-reject-999' });
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedRejectPayment.mockResolvedValue(samplePaymentDetail({ status: 'Failed' }));

    renderPaymentsPage();

    expect(await screen.findByText('Sarah Traveler')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    await user.type(screen.getByLabelText(/rejection reason/i), 'Invalid receipt details.');
    await user.click(screen.getByRole('button', { name: /confirm rejection/i }));

    await waitFor(() => {
      expect(screen.queryByText('Sarah Traveler')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/payment of \$350\.00 rejected/i)).toBeInTheDocument();
  });

  // 12. API approval failure displayed
  it('displays error banner when approvePayment fails', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment();
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedApprovePayment.mockRejectedValue(new Error('Concurrency conflict on payment approval.'));

    renderPaymentsPage();

    expect(await screen.findByText('Sarah Traveler')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    expect(
      await screen.findByText(/failed to approve payment/i),
    ).toBeInTheDocument();
  });

  // 13. API rejection failure displayed
  it('displays error banner when rejectPayment fails', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment();
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedRejectPayment.mockRejectedValue(new Error('Server error rejecting payment.'));

    renderPaymentsPage();

    expect(await screen.findByText('Sarah Traveler')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    await user.type(screen.getByLabelText(/rejection reason/i), 'Slip is unreadable.');
    await user.click(screen.getByRole('button', { name: /confirm rejection/i }));

    expect(await screen.findByText(/failed to reject payment/i)).toBeInTheDocument();
  });

  // 14. OperationsManager route access
  it('allows OperationsManager to access /ops/payments', async () => {
    mockedGetPendingPayments.mockResolvedValue([]);

    renderAppWithAuth('/ops/payments', 'OperationsManager');

    expect(await screen.findByText('Payment Verification')).toBeInTheDocument();
  });

  // 15. Unauthorized role protection
  it('redirects unauthorized Traveler away from /ops/payments', () => {
    renderAppWithAuth('/ops/payments', 'Traveler');

    expect(screen.queryByText('Payment Verification')).not.toBeInTheDocument();
    expect(screen.getByText('Traveler Dashboard Fallback')).toBeInTheDocument();
  });

  // 16. Displays Submitted On Time badge when submitted before deadline
  it('displays Submitted On Time badge when payment submitted before PaymentDueAt', async () => {
    const item = samplePendingPayment({
      submittedAt: '2026-09-29T10:30:00Z',
      paymentDueAt: '2026-09-29T11:00:00Z',
    });
    mockedGetPendingPayments.mockResolvedValue([item]);

    renderPaymentsPage();

    expect(await screen.findByText('Sarah Traveler')).toBeInTheDocument();
    expect(screen.getByText('✓ Submitted On Time')).toBeInTheDocument();
    expect(screen.getByText('Payment Due')).toBeInTheDocument();
  });

  // 17. Slip preview requests authenticated /api/payments/{id}/slip endpoint
  it('requests authenticated /api/payments/{id}/slip endpoint when opening slip preview', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment({ id: 'pay-slip-007' });
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedGetPaymentById.mockResolvedValue(samplePaymentDetail({ id: 'pay-slip-007' }));

    renderPaymentsPage();

    const slipBtn = await screen.findByRole('button', { name: /slip/i });
    await user.click(slipBtn);

    expect(mockedGetPaymentSlipBlob).toHaveBeenCalledWith('pay-slip-007');
  });

  // 18. Image Blob preview renders
  it('renders image Blob preview when slip is an image', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment({ id: 'pay-img-001', bankSlipUrl: 'slips/receipt.jpg' });
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedGetPaymentById.mockResolvedValue(samplePaymentDetail({ id: 'pay-img-001', bankSlipUrl: 'slips/receipt.jpg' }));

    renderPaymentsPage();

    const reviewBtn = await screen.findByRole('button', { name: /review payment/i });
    await user.click(reviewBtn);

    const img = await screen.findByAltText('Bank transfer slip');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'blob:http://localhost:5173/mock-blob-url');
    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  // 19. PDF Blob view action works
  it('provides PDF view action when bank slip is a PDF document', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment({ id: 'pay-pdf-001', bankSlipUrl: 'slips/document.pdf' });
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedGetPaymentById.mockResolvedValue(samplePaymentDetail({ id: 'pay-pdf-001', bankSlipUrl: 'slips/document.pdf' }));
    mockedGetPaymentSlipBlob.mockResolvedValue(new Blob(['pdf-data'], { type: 'application/pdf' }));

    renderPaymentsPage();

    const reviewBtn = await screen.findByRole('button', { name: /review payment/i });
    await user.click(reviewBtn);

    expect(await screen.findByText('PDF Document Attached')).toBeInTheDocument();
    const pdfLink = screen.getByRole('link', { name: /view pdf document/i });
    expect(pdfLink).toHaveAttribute('href', 'blob:http://localhost:5173/mock-blob-url');
    expect(pdfLink).toHaveAttribute('target', '_blank');
  });

  // 20. Object URL cleanup occurs
  it('revokes object URL when modal is closed', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment({ id: 'pay-clean-001' });
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedGetPaymentById.mockResolvedValue(samplePaymentDetail({ id: 'pay-clean-001' }));

    renderPaymentsPage();

    const reviewBtn = await screen.findByRole('button', { name: /review payment/i });
    await user.click(reviewBtn);

    await screen.findByAltText('Bank transfer slip');
    expect(window.URL.createObjectURL).toHaveBeenCalled();

    // Close the review modal
    const closeBtn = screen.getByRole('button', { name: /close/i });
    await user.click(closeBtn);

    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost:5173/mock-blob-url');
  });

  // 21. API failure displays safe error state
  it('displays safe error state and retry action when slip fetching fails', async () => {
    const user = userEvent.setup();
    const item = samplePendingPayment({ id: 'pay-err-001' });
    mockedGetPendingPayments.mockResolvedValue([item]);
    mockedGetPaymentById.mockResolvedValue(samplePaymentDetail({ id: 'pay-err-001' }));
    mockedGetPaymentSlipBlob.mockRejectedValueOnce(new Error('Network error fetching slip'));

    renderPaymentsPage();

    const reviewBtn = await screen.findByRole('button', { name: /review payment/i });
    await user.click(reviewBtn);

    expect(await screen.findByText(/failed to load bank slip file/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry loading slip/i });
    expect(retryBtn).toBeInTheDocument();

    // Click retry
    mockedGetPaymentSlipBlob.mockResolvedValueOnce(new Blob(['mock-bytes'], { type: 'image/jpeg' }));
    await user.click(retryBtn);

    const img = await screen.findByAltText('Bank transfer slip');
    expect(img).toBeInTheDocument();
  });
});
