import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyBookings } from '../../api/bookings';
import { getPackages, type TourPackage } from '../../api/packages';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { PackagesBrowsePage } from './PackagesBrowsePage';
import { TravelerDashboardPage } from './TravelerDashboardPage';

vi.mock('../../api/bookings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/bookings')>()),
  getMyBookings: vi.fn(),
}));
vi.mock('../../api/packages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/packages')>()),
  getPackages: vi.fn(),
}));

const mockedGetMyBookings = vi.mocked(getMyBookings);
const mockedGetPackages = vi.mocked(getPackages);

const PACKAGE = {
  id: 'p1',
  name: 'Hill Country Escape',
  theme: 'Culture',
  durationDays: 3,
  basePricePerPerson: 100,
  maxGroupSize: 10,
  photoUrl: null,
  tiers: [
    { id: 'tier-1', classType: 'Normal', includesFood: true, basePricePerPerson: 100, requiresAC: false },
    { id: 'tier-2', classType: 'First', includesFood: true, basePricePerPerson: 220, requiresAC: true },
  ],
  locations: [{ id: 'l1', name: 'Kandy' }],
} as TourPackage;

const AUTH: AuthContextValue = {
  user: { id: 't1', name: 'Tara Traveler', email: 'tara@example.com', contactNumber: '1', role: 'Traveler' },
  status: 'authenticated',
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
};

function Probe() {
  const location = useLocation();
  return <p>Booking form {location.search}</p>;
}

function renderRoutes() {
  return render(
    <MemoryRouter initialEntries={['/traveler/packages']}>
      <AuthContext.Provider value={AUTH}>
        <Routes>
          <Route path="/traveler" element={<TravelerDashboardPage />} />
          <Route path="/traveler/packages" element={<PackagesBrowsePage />} />
          <Route path="/traveler/bookings/new" element={<Probe />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('traveler pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPackages.mockResolvedValue([PACKAGE]);
    mockedGetMyBookings.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 1 });
  });

  it('shows the dashboard welcome message and the three quick links', async () => {
    render(
      <MemoryRouter initialEntries={['/traveler']}>
        <AuthContext.Provider value={AUTH}>
          <TravelerDashboardPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Tara Traveler')).toBeInTheDocument();
    expect(await screen.findByText(/haven't made any booking requests yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse packages/i })).toHaveAttribute('href', '/traveler/packages');
    expect(screen.getByRole('link', { name: /my bookings/i })).toHaveAttribute('href', '/traveler/bookings');
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/traveler/profile');
  });

  it('counts existing booking requests on the dashboard', async () => {
    mockedGetMyBookings.mockResolvedValue({ items: [], totalCount: 2, page: 1, pageSize: 1 });
    render(
      <MemoryRouter>
        <AuthContext.Provider value={AUTH}>
          <TravelerDashboardPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/you have 2 booking requests on file/i)).toBeInTheDocument();
  });

  it('lists packages with their tiers and starts a booking request for a tier', async () => {
    const user = userEvent.setup();
    renderRoutes();

    expect(screen.getByRole('heading', { name: 'Tour Packages' })).toBeInTheDocument();
    const name = await screen.findByRole('heading', { name: 'Hill Country Escape' });
    const card = name.closest('div.rounded-card') as HTMLElement;
    expect(within(card).getByText('Kandy')).toBeInTheDocument();
    expect(within(card).getByText('$220.00')).toBeInTheDocument();

    await user.click(within(card).getAllByRole('button', { name: 'Request' })[1]);

    expect(await screen.findByText('Booking form ?tier=tier-2')).toBeInTheDocument();
  });

  it('shows the empty state when there are no packages', async () => {
    mockedGetPackages.mockResolvedValue([]);
    renderRoutes();

    expect(await screen.findByText('No tour packages yet.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error when the packages cannot be loaded', async () => {
    mockedGetPackages.mockRejectedValue(new Error('network'));
    renderRoutes();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load tour packages/i);
  });
});
