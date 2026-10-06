import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bookingsApi from '../../api/bookings';
import type { BookingDto, BookingSummaryDto } from '../../api/bookings';
import * as itinerariesApi from '../../api/itineraries';
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

  it('shows Reject for PendingApproval or NeedsManualReview, Mark Completed for Confirmed, and no Approve button', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ id: 'pending-1', status: 'PendingApproval' }),
      sampleBooking({ id: 'confirmed-1', status: 'Confirmed' }),
    ]);

    renderPage();

    await screen.findByText('Pending Approval');
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^reject$/i })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /mark completed/i })).toBeInTheDocument();
  });

  it('shows Reject and Cancel for NeedsManualReview, but does NOT show active Approve action or Assign Tour Guide', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ id: 'review-1', status: 'NeedsManualReview' }),
    ]);

    renderPage();

    await screen.findByText('Needs Manual Review');
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign tour guide/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view agent workflow/i })).toBeInTheDocument();
  });

  it('rejects a booking with notes via the confirm dialog', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ status: 'NeedsManualReview' }),
    ]);
    const decideSpy = vi
      .spyOn(bookingsApi, 'decideBooking')
      .mockResolvedValue(sampleBookingDto({ status: 'Cancelled' }));

    renderPage();
    await screen.findByText('Needs Manual Review');

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

  it('does not show an Itinerary button for a non-confirmed booking', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([sampleBooking({ status: 'PendingApproval' })]);

    renderPage();
    await screen.findByText('Pending Approval');

    expect(screen.queryByRole('button', { name: /^itinerary$/i })).not.toBeInTheDocument();
  });

  it('expands the itinerary for a confirmed booking and allows setting one', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([sampleBooking({ status: 'Confirmed' })]);
    const getItinerarySpy = vi.spyOn(itinerariesApi, 'getItinerary').mockResolvedValue([]);
    const setItinerarySpy = vi.spyOn(itinerariesApi, 'setItinerary').mockResolvedValue([
      { id: 'step-1', bookingId: 'booking-1', dayNumber: 1, activity: 'City tour', location: 'Kandy', startTime: '09:00:00' },
    ]);

    renderPage();
    await screen.findByText('Confirmed');

    await userEvent.click(screen.getByRole('button', { name: /^itinerary$/i }));
    await waitFor(() => expect(getItinerarySpy).toHaveBeenCalledWith('booking-1'));

    await userEvent.click(await screen.findByRole('button', { name: /set itinerary/i }));

    const [activityInput] = screen.getAllByRole('textbox');
    await userEvent.type(activityInput, 'City tour');

    await userEvent.click(screen.getByRole('button', { name: /save itinerary/i }));

    await waitFor(() =>
      expect(setItinerarySpy).toHaveBeenCalledWith('booking-1', [
        { dayNumber: 1, activity: 'City tour', location: '', startTime: '09:00:00' },
      ]),
    );
    expect(await screen.findByText(/City tour/)).toBeInTheDocument();
  });

  it('does not show "Assign Tour Guide" button or guide modal for NeedsManualReview or any other status in Ops view', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ id: 'review-1', status: 'NeedsManualReview' }),
      sampleBooking({ id: 'confirmed-1', status: 'Confirmed' }),
      sampleBooking({ id: 'pending-1', status: 'PendingApproval' }),
    ]);

    renderPage();
    await screen.findByText('Needs Manual Review');

    expect(screen.queryByRole('button', { name: /assign tour guide/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /assign tour guide/i })).not.toBeInTheDocument();
  });
});
