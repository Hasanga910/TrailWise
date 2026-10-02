import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as bookingsApi from '../../api/bookings';
import type { BookingDto, PagedResult } from '../../api/bookings';
import * as itinerariesApi from '../../api/itineraries';
import { MyBookingsPage } from './MyBookingsPage';

function sampleBooking(overrides: Partial<BookingDto> = {}): BookingDto {
  return {
    id: 'booking-1',
    travelerId: 'traveler-1',
    tourPackageId: 'pkg-1',
    tourPackageName: 'Cultural Triangle Explorer',
    packageTier: { id: 'tier-1', classType: 'Normal', includesFood: false, basePricePerPerson: 250, requiresAC: false },
    groupSize: 2,
    startDate: '2030-01-01',
    endDate: '2030-01-05',
    budgetPerPerson: 300,
    status: 'Requested',
    isLargeGroup: false,
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <MyBookingsPage />
    </MemoryRouter>,
  );
}

describe('MyBookingsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders paginated bookings from getMyBookings', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue({
      items: [sampleBooking()],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });

    renderPage();

    expect(await screen.findByText(/Cultural Triangle Explorer/)).toBeInTheDocument();
    expect(screen.getByText('Requested', { selector: 'span' })).toBeInTheDocument();
  });

  it('debounces filter changes before calling the API', async () => {
    vi.useFakeTimers();
    const emptyResult: PagedResult<BookingDto> = { items: [], totalCount: 0, page: 1, pageSize: 10 };
    const getMyBookingsSpy = vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue(emptyResult);

    renderPage();

    await vi.advanceTimersByTimeAsync(300);
    expect(getMyBookingsSpy).toHaveBeenCalledTimes(1);

    const statusSelect = screen.getByLabelText(/status/i);
    fireEvent.change(statusSelect, { target: { value: 'Confirmed' } });
    fireEvent.change(statusSelect, { target: { value: 'Cancelled' } });

    await vi.advanceTimersByTimeAsync(100);
    expect(getMyBookingsSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(300);
    expect(getMyBookingsSpy).toHaveBeenCalledTimes(2);
    expect(getMyBookingsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'Cancelled' }),
    );
  });

  it('disables Previous on page 1 and Next on the last page', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue({
      items: [sampleBooking()],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });

    renderPage();

    await screen.findByText(/Cultural Triangle Explorer/);

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('shows a Cancel Booking button for an upcoming, non-terminal booking', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue({
      items: [sampleBooking({ startDate: '2099-01-01', status: 'Confirmed' })],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });

    renderPage();

    await screen.findByText(/Cultural Triangle Explorer/);
    expect(screen.getByRole('button', { name: /cancel booking/i })).toBeInTheDocument();
  });

  it('does not show a Cancel Booking button for a completed booking', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue({
      items: [sampleBooking({ startDate: '2099-01-01', status: 'Completed' })],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });

    renderPage();

    await screen.findByText(/Cultural Triangle Explorer/);
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument();
  });

  it('does not show a Cancel Booking button for a past booking', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue({
      items: [sampleBooking({ startDate: '2000-01-01', status: 'Confirmed' })],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });

    renderPage();

    await screen.findByText(/Cultural Triangle Explorer/);
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument();
  });

  it('cancels an upcoming booking through the confirm dialog', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue({
      items: [sampleBooking({ startDate: '2099-01-01', status: 'Confirmed' })],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });
    const cancelSpy = vi
      .spyOn(bookingsApi, 'cancelBooking')
      .mockResolvedValue(sampleBooking({ startDate: '2099-01-01', status: 'Cancelled' }));

    renderPage();
    await screen.findByText(/Cultural Triangle Explorer/);

    await userEvent.click(screen.getByRole('button', { name: /cancel booking/i }));
    await userEvent.type(screen.getByLabelText(/reason/i), 'Change of plans');
    await userEvent.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    await waitFor(() => expect(cancelSpy).toHaveBeenCalledWith('booking-1', 'Change of plans'));
    await waitFor(() => expect(screen.getByText('Cancelled', { selector: 'span' })).toBeInTheDocument());
  });

  it('shows the itinerary when View Itinerary is clicked for a confirmed booking', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue({
      items: [sampleBooking({ status: 'Confirmed' })],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });
    const getItinerarySpy = vi.spyOn(itinerariesApi, 'getItinerary').mockResolvedValue([
      { id: 'step-1', bookingId: 'booking-1', dayNumber: 1, activity: 'Temple visit', location: 'Kandy', startTime: '09:00:00' },
    ]);

    renderPage();
    await screen.findByText(/Cultural Triangle Explorer/);

    await userEvent.click(screen.getByRole('button', { name: /view itinerary/i }));

    await waitFor(() => expect(getItinerarySpy).toHaveBeenCalledWith('booking-1'));
    expect(await screen.findByText(/Temple visit/)).toBeInTheDocument();
  });

  it('does not show a View Itinerary button for a non-confirmed booking', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue({
      items: [sampleBooking({ status: 'Requested' })],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });

    renderPage();
    await screen.findByText(/Cultural Triangle Explorer/);

    expect(screen.queryByRole('button', { name: /view itinerary/i })).not.toBeInTheDocument();
  });

  it('displays assigned tour guide details including name, contact, languages, and specializations', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue({
      items: [
        sampleBooking({
          status: 'Confirmed',
          assignedGuide: {
            id: 'guide-1',
            name: 'Janindu',
            contactInfo: '0775645',
            languages: ['Sinhala', 'English'],
            specializations: ['Cultural', 'Wildlife'],
          },
        }),
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });

    renderPage();
    await screen.findByText(/Cultural Triangle Explorer/);

    expect(screen.getByText('Assigned Tour Guide')).toBeInTheDocument();
    expect(screen.getByText('Janindu')).toBeInTheDocument();
    expect(screen.getByText('0775645')).toBeInTheDocument();
    expect(screen.getByText('Sinhala • English')).toBeInTheDocument();
    expect(screen.getByText('Cultural, Wildlife')).toBeInTheDocument();
  });

  it('displays "Tour Guide not assigned yet" when booking has no assigned guide', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue({
      items: [
        sampleBooking({
          status: 'Requested',
          assignedGuide: null,
        }),
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });

    renderPage();
    await screen.findByText(/Cultural Triangle Explorer/);

    expect(screen.getByText('Tour Guide not assigned yet')).toBeInTheDocument();
    expect(screen.queryByText('Assigned Tour Guide')).not.toBeInTheDocument();
  });

  it('does not display guide info or unassigned note for cancelled booking', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue({
      items: [
        sampleBooking({
          status: 'Cancelled',
          assignedGuide: null,
        }),
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });

    renderPage();
    await screen.findByText(/Cultural Triangle Explorer/);

    expect(screen.queryByText('Tour Guide not assigned yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Assigned Tour Guide')).not.toBeInTheDocument();
  });
});
