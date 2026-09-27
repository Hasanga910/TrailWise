import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bookingsApi from '../../api/bookings';
import type { BookingDto, BookingSummaryDto } from '../../api/bookings';
import { OpsBookingsPage } from './OpsBookingsPage';

function sampleBooking(overrides: Partial<BookingSummaryDto> = {}): BookingSummaryDto {
  return {
    id: 'booking-1',
    travelerName: 'Jane Traveler',
    packageName: 'Cultural Triangle Explorer',
    status: 'Confirmed',
    createdAt: '2030-01-01T00:00:00Z',
    startDate: '2030-02-01',
    groupSize: 2,
    ...overrides,
  };
}

function sampleBookingDto(overrides: Partial<BookingDto> = {}): BookingDto {
  return {
    id: 'booking-1',
    travelerId: 'traveler-1',
    tourPackageId: 'package-1',
    tourPackageName: 'Cultural Triangle Explorer',
    packageTier: {
      id: 'tier-1',
      classType: 'Normal',
      includesFood: false,
      basePricePerPerson: 200,
      requiresAC: false,
    },
    groupSize: 2,
    startDate: '2030-02-01',
    endDate: '2030-02-04',
    budgetPerPerson: 500,
    status: 'Confirmed',
    isLargeGroup: false,
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <OpsBookingsPage />
    </MemoryRouter>,
  );
}

describe('OpsBookingsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders bookings with a working "View agent workflow" link per row', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([sampleBooking()]);

    renderPage();

    expect(await screen.findByText('Jane Traveler')).toBeInTheDocument();
    expect(screen.getByText('Cultural Triangle Explorer')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /view agent workflow/i });
    expect(link).toHaveAttribute('href', '/ops/bookings/booking-1/workflow');
  });

  it('shows an empty state when there are no bookings', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/no bookings yet/i)).toBeInTheDocument();
  });

  it('shows an error banner when the request fails', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockRejectedValue(new Error('network error'));

    renderPage();

    expect(await screen.findByText(/could not load bookings/i)).toBeInTheDocument();
  });

  it('shows Approve/Reject only for PendingApproval or NeedsManualReview bookings, not Confirmed', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ id: 'pending-1', status: 'PendingApproval' }),
      sampleBooking({ id: 'confirmed-1', status: 'Confirmed' }),
    ]);

    renderPage();

    await screen.findByText('PendingApproval');
    expect(screen.getAllByRole('button', { name: /^approve$/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^reject$/i })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /mark completed/i })).toBeInTheDocument();
  });

  it('approves a pending booking and updates its status in place', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ status: 'PendingApproval' }),
    ]);
    const decideSpy = vi
      .spyOn(bookingsApi, 'decideBooking')
      .mockResolvedValue(sampleBookingDto({ status: 'Confirmed' }));

    renderPage();
    await screen.findByText('PendingApproval');

    await userEvent.click(screen.getByRole('button', { name: /^approve$/i }));

    await waitFor(() => expect(screen.getByText('Confirmed')).toBeInTheDocument());
    expect(decideSpy).toHaveBeenCalledWith('booking-1', { decision: 'Approve' });
  });

  it('rejects a booking with notes via the confirm dialog', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ status: 'NeedsManualReview' }),
    ]);
    const decideSpy = vi
      .spyOn(bookingsApi, 'decideBooking')
      .mockResolvedValue(sampleBookingDto({ status: 'Cancelled' }));

    renderPage();
    await screen.findByText('NeedsManualReview');

    await userEvent.click(screen.getByRole('button', { name: /^reject$/i }));
    await userEvent.type(screen.getByLabelText(/notes/i), 'Budget too low');

    const rejectButtons = screen.getAllByRole('button', { name: /^reject$/i });
    await userEvent.click(rejectButtons[rejectButtons.length - 1]);

    await waitFor(() =>
      expect(decideSpy).toHaveBeenCalledWith('booking-1', { decision: 'Reject', notes: 'Budget too low' }),
    );
  });

  it('marks a confirmed booking as completed', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([sampleBooking({ status: 'Confirmed' })]);
    const completeSpy = vi
      .spyOn(bookingsApi, 'completeBooking')
      .mockResolvedValue(sampleBookingDto({ status: 'Completed' }));

    renderPage();
    await screen.findByText('Confirmed');

    await userEvent.click(screen.getByRole('button', { name: /mark completed/i }));

    await waitFor(() => expect(screen.getByText('Completed')).toBeInTheDocument());
    expect(completeSpy).toHaveBeenCalledWith('booking-1');
  });

  it('does not show a Cancel button for a Completed booking', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([sampleBooking({ status: 'Completed' })]);

    renderPage();
    await screen.findByText('Completed');

    expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument();
  });
});
