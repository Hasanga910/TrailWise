import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyAssignedTours, type AssignedTourDto } from '../../api/assignedTours';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import type { CurrentUser } from '../../auth/types';
import { AssignedToursPage } from './AssignedToursPage';

vi.mock('../../api/assignedTours', () => ({
  getMyAssignedTours: vi.fn(),
}));

const mockedGetMyAssignedTours = vi.mocked(getMyAssignedTours);

const tourGuideUser: CurrentUser = {
  id: 'user-guide-1',
  name: 'Kasun Perera',
  email: 'kasun@example.com',
  contactNumber: '+94771234567',
  role: 'TourGuide',
};

function renderPage() {
  const authValue: AuthContextValue = {
    user: tourGuideUser,
    status: 'authenticated',
    error: null,
    login: vi.fn().mockResolvedValue(true),
    register: vi.fn().mockResolvedValue(true),
    logout: vi.fn(),
    updateUser: vi.fn(),
  };

  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <AssignedToursPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

const sampleTour: AssignedTourDto = {
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
};

describe('AssignedToursPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when there are no assigned tours', async () => {
    mockedGetMyAssignedTours.mockResolvedValue([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No tours assigned yet.')).toBeInTheDocument();
    });
  });

  it('renders a tour with its package name and dates', async () => {
    mockedGetMyAssignedTours.mockResolvedValue([sampleTour]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Sri Lanka Highlands/)).toBeInTheDocument();
    });
    expect(screen.getByText(/2026-05-01 to 2026-05-05/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sri Lanka Highlands/ })).toHaveAttribute(
      'href',
      '/guides/my-tours/booking-1',
    );
  });

  it('shows an error state with a retry option when the load fails', async () => {
    mockedGetMyAssignedTours.mockRejectedValueOnce(new Error('network error'));
    mockedGetMyAssignedTours.mockResolvedValueOnce([sampleTour]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Error Loading Tours')).toBeInTheDocument();
    });
  });
});
