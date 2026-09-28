import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bookingsApi from '../../api/bookings';
import { FleetBookingsPage } from './FleetBookingsPage';

const mockBookings: bookingsApi.BookingDto[] = [
  {
    id: 'b1-uuid-1234',
    travelerId: 't1-uuid',
    tourPackageId: 'p1-uuid',
    tourPackageName: 'Ella Adventure',
    packageTier: {
      id: 'tier-1',
      classType: 'First',
      includesFood: true,
      basePricePerPerson: 150,
      requiresAC: true,
    },
    groupSize: 4,
    startDate: '2026-10-10',
    endDate: '2026-10-14',
    budgetPerPerson: 200,
    specialRequests: 'Child seat requested',
    status: 'Confirmed',
    isLargeGroup: false,
  },
];

describe('FleetBookingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(bookingsApi, 'getPagedBookings').mockResolvedValue({
      items: mockBookings,
      totalCount: 1,
      page: 1,
      pageSize: 50,
    });
  });

  it('renders bookings list and quick actions', async () => {
    render(<FleetBookingsPage />);

    expect(screen.getByRole('heading', { name: /bookings & allocation reference/i })).toBeInTheDocument();
    expect(await screen.findByText('Ella Adventure')).toBeInTheDocument();
    expect(screen.getByText('b1-uuid-1234')).toBeInTheDocument();
    expect(screen.getByText('4 Guests')).toBeInTheDocument();
  });
});
