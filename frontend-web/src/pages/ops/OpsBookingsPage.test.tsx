import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllBookings, type BookingSummaryDto } from '../../api/bookings';
import { OpsBookingsPage } from './OpsBookingsPage';

vi.mock('../../api/bookings', () => ({
  getAllBookings: vi.fn(),
}));

const mockedGetAllBookings = vi.mocked(getAllBookings);

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

function renderPage() {
  render(
    <MemoryRouter>
      <OpsBookingsPage />
    </MemoryRouter>,
  );
}

describe('OpsBookingsPage', () => {
  beforeEach(() => {
    mockedGetAllBookings.mockReset();
  });

  it('renders bookings with a working "View agent workflow" link per row', async () => {
    mockedGetAllBookings.mockResolvedValue([sampleBooking()]);

    renderPage();

    expect(await screen.findByText('Jane Traveler')).toBeInTheDocument();
    expect(screen.getByText('Cultural Triangle Explorer')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /view agent workflow/i });
    expect(link).toHaveAttribute('href', '/ops/bookings/booking-1/workflow');
  });

  it('shows an empty state when there are no bookings', async () => {
    mockedGetAllBookings.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/no bookings yet/i)).toBeInTheDocument();
  });

  it('shows an error banner when the request fails', async () => {
    mockedGetAllBookings.mockRejectedValue(new Error('network error'));

    renderPage();

    expect(await screen.findByText(/could not load bookings/i)).toBeInTheDocument();
  });
});
