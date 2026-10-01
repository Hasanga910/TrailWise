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

  it('shows Approve only for PendingApproval, Reject for PendingApproval or NeedsManualReview, and not Confirmed', async () => {
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

  it('shows Assign Tour Guide, Reject, and Cancel for NeedsManualReview, but does NOT show active Approve action', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ id: 'review-1', status: 'NeedsManualReview' }),
    ]);

    renderPage();

    await screen.findByText('NeedsManualReview');
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /assign tour guide/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view agent workflow/i })).toBeInTheDocument();
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

  it('does not show an Itinerary button for a non-confirmed booking', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([sampleBooking({ status: 'PendingApproval' })]);

    renderPage();
    await screen.findByText('PendingApproval');

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

  it('shows "Assign Tour Guide" only for NeedsManualReview bookings, not Confirmed', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ id: 'review-1', status: 'NeedsManualReview' }),
      sampleBooking({ id: 'confirmed-1', status: 'Confirmed' }),
    ]);

    renderPage();
    await screen.findByText('NeedsManualReview');

    const assignBtns = screen.getAllByRole('button', { name: /assign tour guide/i });
    expect(assignBtns).toHaveLength(1);
  });

  it('opens assignment modal, loads available guides, and shows guide info', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ id: 'review-1', status: 'NeedsManualReview', packageName: 'Safari Adventure' }),
    ]);
    const guidesSpy = vi.spyOn(bookingsApi, 'getAvailableGuidesForBooking').mockResolvedValue([
      {
        guideId: 'guide-1',
        name: 'Guide Alpha',
        languages: ['English', 'German'],
        specializations: ['Wildlife'],
        contactInfo: '+94771234567',
        matchesSpecialization: true,
        matchesLanguage: true,
        notes: 'Matches package theme: Wildlife',
      },
    ]);

    renderPage();
    await screen.findByText('NeedsManualReview');

    await userEvent.click(screen.getByRole('button', { name: /assign tour guide/i }));

    expect(await screen.findByRole('heading', { name: /assign tour guide/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Safari Adventure/).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('Guide Alpha')).toBeInTheDocument();
    expect(screen.getByText(/Matches package theme: Wildlife/)).toBeInTheDocument();
    expect(guidesSpy).toHaveBeenCalledWith('review-1');
  });

  it('allows selecting a guide, shows confirmation prompt, and confirms assignment successfully', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings')
      .mockResolvedValueOnce([
        sampleBooking({ id: 'review-1', status: 'NeedsManualReview' }),
      ])
      .mockResolvedValue([
        sampleBooking({ id: 'review-1', status: 'Confirmed' }),
      ]);
    vi.spyOn(bookingsApi, 'getAvailableGuidesForBooking').mockResolvedValue([
      {
        guideId: 'guide-1',
        name: 'Guide Alpha',
        languages: ['English'],
        specializations: ['Wildlife'],
        contactInfo: '+94771234567',
        matchesSpecialization: true,
        matchesLanguage: true,
      },
    ]);
    const assignSpy = vi.spyOn(bookingsApi, 'assignGuide').mockResolvedValue({
      bookingId: 'review-1',
      guideId: 'guide-1',
      status: 'Confirmed',
    });

    renderPage();
    await screen.findByText('NeedsManualReview');

    await userEvent.click(screen.getByRole('button', { name: /assign tour guide/i }));
    await screen.findByText('Guide Alpha');

    // Select guide radio
    await userEvent.click(screen.getByRole('radio'));

    // Click Assign Guide
    await userEvent.click(screen.getByRole('button', { name: /^assign guide$/i }));

    // Confirmation shown
    expect(await screen.findByRole('button', { name: /confirm assignment/i })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.textContent === 'Assign Guide Alpha to this booking?')).toBeInTheDocument();

    // Confirm assignment
    await userEvent.click(screen.getByRole('button', { name: /confirm assignment/i }));

    await waitFor(() =>
      expect(assignSpy).toHaveBeenCalledWith('review-1', 'guide-1'),
    );
    expect(await screen.findByText(/guide successfully assigned/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Confirmed')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /assign tour guide/i })).not.toBeInTheDocument();
  });

  it('displays error message on assignment conflict and reloads available guides', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ id: 'review-1', status: 'NeedsManualReview' }),
    ]);
    const guidesSpy = vi.spyOn(bookingsApi, 'getAvailableGuidesForBooking').mockResolvedValue([
      {
        guideId: 'guide-1',
        name: 'Guide Alpha',
        languages: ['English'],
        specializations: ['Wildlife'],
        contactInfo: '+94771234567',
        matchesSpecialization: true,
        matchesLanguage: true,
      },
    ]);
    vi.spyOn(bookingsApi, 'assignGuide').mockRejectedValue(
      new Error('Selected guide is no longer available for this booking.'),
    );

    renderPage();
    await screen.findByText('NeedsManualReview');

    await userEvent.click(screen.getByRole('button', { name: /assign tour guide/i }));
    await screen.findByText('Guide Alpha');

    await userEvent.click(screen.getByRole('radio'));
    await userEvent.click(screen.getByRole('button', { name: /^assign guide$/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm assignment/i }));

    expect(await screen.findByText(/selected guide is no longer available/i)).toBeInTheDocument();
    expect(guidesSpy).toHaveBeenCalledTimes(2); // Initial fetch + reload after conflict
  });
});
