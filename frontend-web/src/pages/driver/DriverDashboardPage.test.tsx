import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyDriverAssignments, type VehicleAssignmentDetailDto } from '../../api/vehicles';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { DriverDashboardPage } from './DriverDashboardPage';

vi.mock('../../api/vehicles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/vehicles')>()),
  getMyDriverAssignments: vi.fn(),
}));

const mockedGetAssignments = vi.mocked(getMyDriverAssignments);

function task(overrides: Partial<VehicleAssignmentDetailDto>): VehicleAssignmentDetailDto {
  return {
    id: 'a1',
    bookingId: 'b1-uuid',
    vehicleId: 'v1',
    vehicleName: 'Van',
    vehicleType: 'Van',
    registrationNumber: 'WP-ND-5678',
    hasAC: true,
    capacity: 10,
    driverName: 'Dan Driver',
    startDate: '2999-01-10',
    endDate: '2999-01-14',
    bookingStatus: 'Confirmed',
    packageName: 'Hill Country Escape',
    packageTier: 'First',
    travelerName: 'Tara Traveler',
    travelerContact: '0771234567',
    groupSize: 4,
    specialRequests: 'Window seats please',
    ...overrides,
  } as VehicleAssignmentDetailDto;
}

const AUTH: AuthContextValue = {
  user: { id: 'd1', name: 'Dan Driver', email: 'dan@example.com', contactNumber: '1', role: 'Driver' },
  status: 'authenticated',
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
};

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={AUTH}>
        <DriverDashboardPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('DriverDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAssignments.mockResolvedValue([
      task({ id: 'a1' }),
      task({ id: 'a2', bookingId: 'b2-uuid', packageName: 'Old Coastal Trip', startDate: '2020-01-01', endDate: '2020-01-03' }),
      task({ id: 'a3', bookingId: 'b3-uuid', packageName: 'Cancelled Safari', bookingStatus: 'Cancelled' }),
    ]);
  });

  it('greets the driver and lists upcoming tasks with tab counts', async () => {
    renderPage();

    expect(screen.getByText(/welcome back, dan/i)).toBeInTheDocument();
    expect(await screen.findByText('Hill Country Escape')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Upcoming Tours (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Past / Completed (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All Assignments (3)' })).toBeInTheDocument();
    expect(screen.getByText('Active Tour Task')).toBeInTheDocument();
    expect(screen.getByText('WP-ND-5678')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /call traveler/i })).toHaveAttribute('href', 'tel:0771234567');
    expect(screen.queryByText('Old Coastal Trip')).not.toBeInTheDocument();
  });

  it('switches tabs to show past and cancelled tours', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Hill Country Escape');

    await user.click(screen.getByRole('tab', { name: /past \/ completed/i }));

    expect(screen.getByText('Old Coastal Trip')).toBeInTheDocument();
    expect(screen.getByText('Tour Completed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled Tour')).toBeInTheDocument();
    expect(screen.queryByText('Hill Country Escape')).not.toBeInTheDocument();
  });

  it('expands and collapses the full booking details', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Hill Country Escape');

    await user.click(screen.getByRole('button', { name: /more info/i }));
    expect(screen.getByText('Window seats please')).toBeInTheDocument();
    expect(screen.getByText('4 Guests')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /less info/i }));
    expect(screen.queryByText('Window seats please')).not.toBeInTheDocument();
  });

  it('shows the empty state with a refresh action', async () => {
    mockedGetAssignments.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No active driving assignments')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh Tasks' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error and retries loading', async () => {
    const user = userEvent.setup();
    mockedGetAssignments.mockRejectedValueOnce(new Error('network'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/error loading driver tasks/i);
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Hill Country Escape')).toBeInTheDocument();
  });
});
