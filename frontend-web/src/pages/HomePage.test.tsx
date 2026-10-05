import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPackages, type TourPackage } from '../api/packages';
import { getFeaturedReviews, type FeaturedReview } from '../api/reviews';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { PublicLayout } from '../components/public/PublicLayout';
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, contactLinks } from '../config/contact';
import { HomePage } from './HomePage';

vi.mock('../api/packages', () => ({ getPackages: vi.fn() }));
vi.mock('../api/reviews', () => ({ getFeaturedReviews: vi.fn() }));

const mockedGetPackages = vi.mocked(getPackages);
const mockedGetFeatured = vi.mocked(getFeaturedReviews);

const PKGS: TourPackage[] = [
  {
    id: 'p1',
    name: 'Hill Country Escape',
    theme: 'Culture',
    durationDays: 3,
    basePricePerPerson: 100,
    maxGroupSize: 10,
    photoUrl: null,
    tiers: [],
    locations: [{ id: 'l', name: 'Kandy' }],
    averageRating: 4.8,
    reviewCount: 5,
    startingPrice: 100,
  },
];

const REVIEWS: FeaturedReview[] = [
  { id: 'r1', rating: 5, comment: 'Unforgettable week', submittedAt: '2026-03-01T00:00:00Z', packageId: 'p1', packageName: 'Hill Country Escape', reviewerDisplayName: 'Verified Traveler' },
];

function auth(authenticated = false): AuthContextValue {
  return {
    user: authenticated ? { id: '1', name: 'Pat', email: 'p@e.com', contactNumber: '1', role: 'Traveler' } : null,
    status: authenticated ? 'authenticated' : 'unauthenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  };
}

function ExplorerProbe() {
  const location = useLocation();
  return <div>Explorer {location.search}</div>;
}

function renderHome(authenticated = false) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthContext.Provider value={auth(authenticated)}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorerProbe />} />
          </Route>
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    mockedGetPackages.mockReset().mockResolvedValue(PKGS);
    mockedGetFeatured.mockReset().mockResolvedValue(REVIEWS);
  });

  it('sells tours to travelers and shows the sections', async () => {
    renderHome();

    expect(screen.getByRole('heading', { level: 1, name: /discover sri lanka/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Top-rated tours' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /why travelers choose trailwise/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How TrailWise plans your trip' })).toBeInTheDocument();
    expect(await screen.findByText(/unforgettable week/i)).toBeInTheDocument();
    expect(mockedGetPackages).toHaveBeenCalledWith({ sort: 'rating', dir: 'desc' }, expect.any(AbortSignal));
  });

  it('explains the smart booking check in traveler terms', () => {
    renderHome();
    const section = within(screen.getByRole('heading', { name: 'How TrailWise plans your trip' }).closest('section')!);
    expect(section.getByText(/guide is free/i)).toBeInTheDocument();
    expect(section.getByText(/vehicle with room for your group/i)).toBeInTheDocument();
  });

  it('turns the hero search into explorer filters', async () => {
    const user = userEvent.setup();
    renderHome();

    const form = within(screen.getByRole('form', { name: 'Find a tour' }));
    await user.type(form.getByLabelText(/where to/i), 'Ella');
    await user.type(form.getByLabelText(/when/i), '2030-02-03');
    await user.click(form.getByRole('button', { name: 'More travelers' }));
    await user.click(form.getByRole('button', { name: 'More travelers' }));
    expect(form.getByText('4 travelers')).toBeInTheDocument();
    await user.click(form.getByRole('button', { name: /find tours/i }));

    expect(await screen.findByText('Explorer ?q=Ella&start=2030-02-03&guests=4')).toBeInTheDocument();
  });

  it('keeps the traveler count between 1 and 50', async () => {
    const user = userEvent.setup();
    renderHome();
    const form = within(screen.getByRole('form', { name: 'Find a tour' }));

    await user.click(form.getByRole('button', { name: 'Fewer travelers' }));
    await user.click(form.getByRole('button', { name: 'Fewer travelers' }));
    expect(form.getByText('1 traveler')).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Fewer travelers' })).toBeDisabled();
  });

  it('hides the carousel and testimonials quietly when the API has nothing or fails', async () => {
    mockedGetPackages.mockRejectedValue(new Error('down'));
    mockedGetFeatured.mockResolvedValue([]);
    renderHome();

    expect(await screen.findByRole('heading', { name: /why travelers choose trailwise/i })).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByRole('heading', { name: 'Top-rated tours' })).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'What travelers say' })).not.toBeInTheDocument();
  });

  it('offers a dashboard link when signed in', () => {
    renderHome(true);
    expect(screen.getAllByRole('link', { name: /dashboard/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument();
  });

  it('shows contact details from the single config file and an operators line', () => {
    renderHome();
    const footer = within(screen.getByRole('contentinfo'));

    expect(footer.getByRole('link', { name: CONTACT_EMAIL })).toHaveAttribute('href', contactLinks.email);
    expect(footer.getByRole('link', { name: CONTACT_PHONE_DISPLAY })).toHaveAttribute('href', contactLinks.phone);
    expect(footer.getByRole('link', { name: /whatsapp us/i })).toHaveAttribute('href', contactLinks.whatsapp);
    expect(footer.getByRole('link', { name: /operators, guides and drivers sign in/i })).toHaveAttribute('href', '/login');
  });
});
