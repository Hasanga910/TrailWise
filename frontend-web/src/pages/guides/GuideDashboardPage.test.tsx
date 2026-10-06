import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyAssignedTours, type AssignedTourDto } from '../../api/assignedTours';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import type { CurrentUser } from '../../auth/types';
import { GuideLayout } from '../../components/guides/GuideLayout';
import { GuideDashboardPage } from './GuideDashboardPage';
import { ThemeProvider } from '../../theme/ThemeProvider';

vi.mock('../../api/assignedTours', () => ({
  getMyAssignedTours: vi.fn(),
}));

vi.mock('../../api/guides', () => ({
  getGuides: vi.fn().mockResolvedValue([]),
  getGuideAvailability: vi.fn().mockResolvedValue([]),
}));

const mockedGetMyAssignedTours = vi.mocked(getMyAssignedTours);

const tourGuideUser: CurrentUser = {
  id: 'user-guide-1',
  name: 'Kasun Perera',
  email: 'kasun@example.com',
  contactNumber: '+94771234567',
  role: 'TourGuide',
};

const sampleTours: AssignedTourDto[] = [
  // 1. Upcoming confirmed tour (active/upcoming)
  {
    bookingId: 'booking-1',
    startDate: '2026-05-01',
    endDate: '2026-05-05',
    groupSize: 4,
    status: 'Confirmed',
    tourPackageId: 'pkg-1',
    tourPackageName: 'Sri Lanka Highlands',
    theme: 'Adventure',
    locations: ['Ella', 'Kandy'],
    specialRequests: null,
    guideId: 'guide-1',
    guideName: 'Kasun Perera',
    attended: false,
    completed: false,
    guideNotes: null,
    tourStartedAt: null,
    tourEndedAt: null,
  },
  // 2. In-progress tour (active/upcoming)
  {
    bookingId: 'booking-2',
    startDate: '2026-05-10',
    endDate: '2026-05-15',
    groupSize: 2,
    status: 'Confirmed',
    tourPackageId: 'pkg-2',
    tourPackageName: 'Cultural Triangle',
    theme: 'Culture',
    locations: ['Sigiriya', 'Anuradhapura'],
    specialRequests: null,
    guideId: 'guide-1',
    guideName: 'Kasun Perera',
    attended: true,
    completed: false,
    guideNotes: 'Underway',
    tourStartedAt: '2026-05-10T08:00:00Z',
    tourEndedAt: null,
  },
  // 3. Completed tour (should NOT be counted in upcoming)
  {
    bookingId: 'booking-3',
    startDate: '2026-04-01',
    endDate: '2026-04-05',
    groupSize: 3,
    status: 'Completed',
    tourPackageId: 'pkg-3',
    tourPackageName: 'Southern Coastline',
    theme: 'Leisure',
    locations: ['Galle', 'Mirissa'],
    specialRequests: null,
    guideId: 'guide-1',
    guideName: 'Kasun Perera',
    attended: true,
    completed: true,
    guideNotes: 'All done',
    tourStartedAt: '2026-04-01T08:00:00Z',
    tourEndedAt: '2026-04-05T18:00:00Z',
  },
  // 4. Cancelled tour (should NOT be counted in upcoming)
  {
    bookingId: 'booking-4',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
    groupSize: 2,
    status: 'Cancelled',
    tourPackageId: 'pkg-4',
    tourPackageName: 'Yala Safari',
    theme: 'Wildlife',
    locations: ['Yala'],
    specialRequests: null,
    guideId: 'guide-1',
    guideName: 'Kasun Perera',
    attended: false,
    completed: false,
    guideNotes: null,
    tourStartedAt: null,
    tourEndedAt: null,
  },
];

async function renderDashboard(user: CurrentUser = tourGuideUser) {
  const authValue: AuthContextValue = {
    user,
    status: 'authenticated',
    error: null,
    login: vi.fn().mockResolvedValue(true),
    register: vi.fn().mockResolvedValue(true),
    logout: vi.fn(),
    updateUser: vi.fn(),
  };

  const utils = render(
    <MemoryRouter initialEntries={['/guides']}>
      <ThemeProvider>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/guides" element={<GuideLayout />}>
            <Route index element={<GuideDashboardPage />} />
            <Route path="dashboard" element={<GuideDashboardPage />} />
          </Route>
          <Route path="/guides/my-tours" element={<div>Destination: My Assigned Tours Page</div>} />
          <Route path="/guides/availability" element={<div>Destination: Guide Availability Page</div>} />
          <Route path="/guides/profile" element={<div>Destination: Guide Profile Page</div>} />
        </Routes>
      </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>,
  );

  await screen.findByText(/Welcome back,/i);
  return utils;
}

describe('GuideDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetMyAssignedTours.mockReset();
  });

  // 1. Dashboard renders for TourGuide.
  it('renders the dashboard with header and Tour Guide sidebar navigation', async () => {
    mockedGetMyAssignedTours.mockResolvedValue(sampleTours);
    await renderDashboard();

    // Header title
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();

    // Guide role label in header
    expect(screen.getByText('Tour Guide')).toBeInTheDocument();

    // Sidebar navigation items
    const sidebar = screen.getByRole('navigation', { name: 'Primary' });
    expect(sidebar).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Dashboard$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^My Tours$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Guide Availability$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Profile$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log out/i })).toBeInTheDocument();
  });

  // 2. Welcome message displays guide name.
  it('displays the welcome message with the logged-in guide name', async () => {
    mockedGetMyAssignedTours.mockResolvedValue(sampleTours);
    await renderDashboard();

    const welcomeMsg = await screen.findByText(/Welcome back,/i);
    expect(welcomeMsg).toBeInTheDocument();
    expect(welcomeMsg).toHaveTextContent('Kasun Perera');
  });

  // 3. Assigned tour count is displayed.
  it('calculates and displays the upcoming assigned tour count excluding completed and cancelled tours', async () => {
    mockedGetMyAssignedTours.mockResolvedValue(sampleTours);
    await renderDashboard();

    // 2 active/upcoming tours out of 4 total
    expect(await screen.findByText(/You have 2 upcoming assigned tours\./i)).toBeInTheDocument();
  });

  it('displays 0 upcoming assigned tours when none exist', async () => {
    mockedGetMyAssignedTours.mockResolvedValue([]);
    await renderDashboard();

    expect(await screen.findByText(/You have 0 upcoming assigned tours\./i)).toBeInTheDocument();
  });

  // 4. My Assigned Tours card is visible.
  it('renders My Assigned Tours card with expected title and description', async () => {
    mockedGetMyAssignedTours.mockResolvedValue(sampleTours);
    await renderDashboard();

    expect(screen.getByRole('heading', { level: 2, name: 'My Assigned Tours' })).toBeInTheDocument();
    expect(screen.getByText('View your upcoming and active tours.')).toBeInTheDocument();
  });

  // 5. Guide Availability card is visible.
  it('renders Guide Availability card with expected title and description', async () => {
    mockedGetMyAssignedTours.mockResolvedValue(sampleTours);
    await renderDashboard();

    expect(screen.getByRole('heading', { level: 2, name: 'Guide Availability' })).toBeInTheDocument();
    expect(screen.getByText('Manage the days you are available for tours.')).toBeInTheDocument();
  });

  // 6. Profile card is visible.
  it('renders Profile card with expected title and description', async () => {
    mockedGetMyAssignedTours.mockResolvedValue(sampleTours);
    await renderDashboard();

    expect(screen.getByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument();
    expect(
      screen.getByText('Update your guide details, languages, specializations, and password.'),
    ).toBeInTheDocument();
  });

  // 7. Cards navigate to correct routes.
  it('navigates to the correct routes when each card is clicked', async () => {
    const user = userEvent.setup();
    mockedGetMyAssignedTours.mockResolvedValue(sampleTours);
    await renderDashboard();

    // Click My Assigned Tours card
    const myToursCard = screen.getByRole('link', { name: /My Assigned Tours View your upcoming and active tours\./i });
    await user.click(myToursCard);
    expect(await screen.findByText('Destination: My Assigned Tours Page')).toBeInTheDocument();

    // Re-render and click Guide Availability card
    await renderDashboard();
    const availabilityCard = screen.getByRole('link', {
      name: /Guide Availability Manage the days you are available for tours\./i,
    });
    await user.click(availabilityCard);
    expect(await screen.findByText('Destination: Guide Availability Page')).toBeInTheDocument();

    // Re-render and click Profile card
    await renderDashboard();
    const profileCard = screen.getByRole('link', {
      name: /Profile Update your guide details, languages, specializations, and password\./i,
    });
    await user.click(profileCard);
    expect(await screen.findByText('Destination: Guide Profile Page')).toBeInTheDocument();
  });

  // 8. No Traveler-only Packages/My Bookings controls appear.
  it('does not display Traveler-only controls like Browse Packages or My Bookings', async () => {
    mockedGetMyAssignedTours.mockResolvedValue(sampleTours);
    await renderDashboard();

    expect(screen.queryByRole('link', { name: /Browse Packages/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^My Bookings$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Browse Packages/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^My Bookings$/i)).not.toBeInTheDocument();
  });

  // 9. No Fleet/Admin/Ops controls appear.
  it('does not display Fleet, Operations, or Admin controls', async () => {
    mockedGetMyAssignedTours.mockResolvedValue(sampleTours);
    await renderDashboard();

    expect(screen.queryByText(/Overview & Allocation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Vehicles$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Drivers$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vehicle Assignments/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Guide Assignments/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Operations/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Reports$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Discounts$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/User Management/i)).not.toBeInTheDocument();
  });
});
