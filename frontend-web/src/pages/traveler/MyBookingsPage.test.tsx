import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyBookings, type BookingDto, type PagedResult } from '../../api/bookings';
import { MyBookingsPage } from './MyBookingsPage';

vi.mock('../../api/bookings', () => ({
  getMyBookings: vi.fn(),
}));

const mockedGetMyBookings = vi.mocked(getMyBookings);

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
    mockedGetMyBookings.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders paginated bookings from getMyBookings', async () => {
    mockedGetMyBookings.mockResolvedValue({
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
    mockedGetMyBookings.mockResolvedValue(emptyResult);

    renderPage();

    await vi.advanceTimersByTimeAsync(300);
    expect(mockedGetMyBookings).toHaveBeenCalledTimes(1);

    const statusSelect = screen.getByLabelText(/status/i);
    fireEvent.change(statusSelect, { target: { value: 'Confirmed' } });
    fireEvent.change(statusSelect, { target: { value: 'Cancelled' } });

    await vi.advanceTimersByTimeAsync(100);
    expect(mockedGetMyBookings).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(300);
    expect(mockedGetMyBookings).toHaveBeenCalledTimes(2);
    expect(mockedGetMyBookings).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'Cancelled' }),
    );
  });

  it('disables Previous on page 1 and Next on the last page', async () => {
    mockedGetMyBookings.mockResolvedValue({
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
});
