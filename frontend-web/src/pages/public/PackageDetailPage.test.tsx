import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getActiveDiscounts } from '../../api/discounts';
import { getPackageById, type TourPackage } from '../../api/packages';
import { getPackageReviews, type PackageReviews } from '../../api/reviews';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import type { CurrentUser, UserRole } from '../../auth/types';
import { PackageDetailPage } from './PackageDetailPage';

vi.mock('../../api/packages', () => ({ getPackageById: vi.fn() }));
vi.mock('../../api/reviews', () => ({ getPackageReviews: vi.fn() }));
vi.mock('../../api/discounts', () => ({ getActiveDiscounts: vi.fn() }));
// Leaflet needs a real browser; the page only has to hand it the plottable points.
vi.mock('../../components/explorer/LocationsMap', () => ({
  LocationsMap: ({ points }: { points: { name: string }[] }) => <div data-testid="map">{points.map((p) => p.name).join(',')}</div>,
}));

const mockedGetPackage = vi.mocked(getPackageById);
const mockedGetReviews = vi.mocked(getPackageReviews);
const mockedGetDiscounts = vi.mocked(getActiveDiscounts);

const PKG: TourPackage = {
  id: 'pkg-1',
  name: 'Hill Country Escape',
  theme: 'Culture',
  durationDays: 3,
  basePricePerPerson: 100,
  maxGroupSize: 10,
  photoUrl: null,
  averageRating: 4.5,
  reviewCount: 2,
  startingPrice: 100,
  tiers: [
    { id: 'tier-first', classType: 'First', includesFood: true, basePricePerPerson: 300, requiresAC: true },
    { id: 'tier-normal', classType: 'Normal', includesFood: false, basePricePerPerson: 100, requiresAC: false },
  ],
  locations: [
    { id: 'l1', name: 'Kandy', latitude: 7.29, longitude: 80.63 },
    { id: 'l2', name: 'Atlantis', latitude: null, longitude: null },
    { id: 'l3', name: 'Ella', latitude: 6.86, longitude: 81.04 },
  ],
};

const REVIEWS: PackageReviews = {
  tourPackageId: 'pkg-1',
  averageRating: 4.5,
  totalReviews: 2,
  reviews: [
    { id: 'r1', rating: 5, comment: 'Wonderful trip', submittedAt: '2026-03-01T00:00:00Z', reviewerDisplayName: 'Verified Traveler', isVerifiedTrip: true },
    { id: 'r2', rating: 4, comment: 'Very good', submittedAt: '2026-02-01T00:00:00Z', reviewerDisplayName: 'Verified Traveler', isVerifiedTrip: true },
  ],
};

function auth(role: UserRole | null): AuthContextValue {
  const user: CurrentUser | null = role ? { id: '1', name: 'Pat', email: 'p@example.com', contactNumber: '1', role } : null;
  return {
    user,
    status: role ? 'authenticated' : 'unauthenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  };
}

function RegisterProbe() {
  const location = useLocation();
  return <div>Register from={(location.state as { from?: string } | null)?.from ?? 'none'}</div>;
}

function renderDetail(role: UserRole | null = null, path = '/explore/pkg-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={auth(role)}>
        <Routes>
          <Route path="/explore/:packageId" element={<PackageDetailPage />} />
          <Route path="/register" element={<RegisterProbe />} />
          <Route path="/explore" element={<div>Explorer</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('PackageDetailPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockedGetPackage.mockReset().mockResolvedValue(PKG);
    mockedGetReviews.mockReset().mockResolvedValue(REVIEWS);
    mockedGetDiscounts.mockReset().mockResolvedValue([]);
  });

  it('shows the tour, its classes with the cheapest preselected, and updates the price when another is chosen', async () => {
    const user = userEvent.setup();
    renderDetail();

    expect(await screen.findByRole('heading', { level: 1, name: 'Hill Country Escape' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('radio', { name: 'Normal' })).toBeChecked();
    expect(within(table).getByText('$300')).toBeInTheDocument();

    const booking = within(screen.getByRole('complementary', { name: 'Booking' }));
    expect(booking.getByText('$100')).toBeInTheDocument();

    await user.click(within(table).getByRole('radio', { name: 'First' }));
    expect(booking.getByText('$300')).toBeInTheDocument();
    expect(booking.getByText(/First class from/)).toBeInTheDocument();
  });

  it('plots only locations that have coordinates and flags the rest', async () => {
    renderDetail();

    expect(await screen.findByTestId('map')).toHaveTextContent('Kandy,Ella');
    expect(screen.getByText('Not on map')).toBeInTheDocument();
    expect(screen.getByText('Atlantis')).toBeInTheDocument();
  });

  it('explains when no location has coordinates', async () => {
    mockedGetPackage.mockResolvedValue({ ...PKG, locations: [{ id: 'l2', name: 'Atlantis', latitude: null, longitude: null }] });
    renderDetail();

    expect(await screen.findByText(/map for this tour isn't available yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
  });

  it('shows reviews with the rating breakdown', async () => {
    renderDetail();

    expect(await screen.findByText('Wonderful trip')).toBeInTheDocument();
    expect(screen.getByText('Very good')).toBeInTheDocument();
    const breakdown = within(screen.getByRole('list', { name: 'Rating breakdown' }));
    expect(breakdown.getAllByRole('listitem')).toHaveLength(5);
  });

  it('shows an empty state when there are no reviews and a quiet note when they fail to load', async () => {
    mockedGetReviews.mockResolvedValueOnce({ tourPackageId: 'pkg-1', averageRating: 0, totalReviews: 0, reviews: [] });
    const first = renderDetail();
    expect(await screen.findByText('No reviews yet', { selector: 'h3' })).toBeInTheDocument();
    first.unmount();

    mockedGetReviews.mockRejectedValueOnce(new Error('boom'));
    renderDetail();
    expect(await screen.findByText(/reviews couldn't be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Hill Country Escape' })).toBeInTheDocument();
  });

  it('shows current offers', async () => {
    mockedGetDiscounts.mockResolvedValue([
      { id: 'd1', description: 'Early bird', percentageOff: 10, minGroupSize: 4, validFrom: null, validUntil: null },
    ]);
    renderDetail();

    expect(await screen.findByText(/save 10% for groups of 4\+/i)).toBeInTheDocument();
  });

  describe('Book this tour', () => {
    it('sends a logged-out visitor to register and remembers the booking target', async () => {
      const user = userEvent.setup();
      renderDetail(null, '/explore/pkg-1?guests=3&start=2030-02-03');
      await screen.findByRole('heading', { level: 1, name: 'Hill Country Escape' });

      await user.click(screen.getByRole('button', { name: 'Book this tour' }));

      const target = '/traveler/bookings/new?tier=tier-normal&guests=3&start=2030-02-03';
      expect(await screen.findByText(`Register from=${target}`)).toBeInTheDocument();
      expect(sessionStorage.getItem('trailwise_return_to')).toBe(target);
      expect(screen.queryByText(/staff accounts/i)).not.toBeInTheDocument();
    });

    it('offers an existing-account link that carries the same destination', async () => {
      renderDetail();
      const link = await screen.findByRole('link', { name: 'I already have an account' });
      expect(link).toHaveAttribute('href', '/login');
    });

    it('takes a signed-in traveler straight to the booking form with the chosen class', async () => {
      const user = userEvent.setup();
      renderDetail('Traveler');
      await screen.findByRole('heading', { level: 1, name: 'Hill Country Escape' });
      await user.click(screen.getByRole('radio', { name: 'First' }));

      expect(screen.getByRole('link', { name: 'Book this tour' })).toHaveAttribute('href', '/traveler/bookings/new?tier=tier-first');
    });

    it('disables booking for staff accounts and says why', async () => {
      renderDetail('OperationsManager');
      await screen.findByRole('heading', { level: 1, name: 'Hill Country Escape' });

      expect(screen.getByRole('button', { name: 'Book this tour' })).toBeDisabled();
      expect(screen.getByText(/staff accounts can't make bookings/i)).toBeInTheDocument();
    });

    it('ignores malformed guests and start values in the link', async () => {
      renderDetail('Traveler', '/explore/pkg-1?guests=lots&start=soon');
      expect(await screen.findByRole('link', { name: 'Book this tour' })).toHaveAttribute('href', '/traveler/bookings/new?tier=tier-normal');
    });
  });

  it('shows a friendly not-found state for an unknown tour', async () => {
    mockedGetPackage.mockRejectedValue(new AxiosError('Not found', '404', undefined, undefined, { status: 404 } as never));
    renderDetail(null, '/explore/missing');

    expect(await screen.findByText("We couldn't find that tour")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all tours' })).toHaveAttribute('href', '/explore');
  });

  it('shows an error with retry for other failures', async () => {
    const user = userEvent.setup();
    mockedGetPackage.mockRejectedValueOnce(new Error('network'));
    renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load this tour/i);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Hill Country Escape' })).toBeInTheDocument();
  });
});
