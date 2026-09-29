import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMyAssignedTours,
  updateGuideTour,
  type AssignedTourDto,
} from '../../api/assignedTours';
import { getItinerary, type ItineraryStepDto } from '../../api/itineraries';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import type { CurrentUser } from '../../auth/types';
import { TourDetailPage } from './TourDetailPage';

vi.mock('../../api/assignedTours', () => ({
  getMyAssignedTours: vi.fn(),
  updateGuideTour: vi.fn(),
}));

vi.mock('../../api/itineraries', () => ({
  getItinerary: vi.fn(),
  setItinerary: vi.fn(),
}));

const mockedGetMyAssignedTours = vi.mocked(getMyAssignedTours);
const mockedUpdateGuideTour = vi.mocked(updateGuideTour);
const mockedGetItinerary = vi.mocked(getItinerary);

const tourGuideUser: CurrentUser = {
  id: 'user-guide-1',
  name: 'Kasun Perera',
  email: 'kasun@example.com',
  contactNumber: '+94771234567',
  role: 'TourGuide',
};

function renderPage(bookingId = 'booking-1') {
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
    <MemoryRouter initialEntries={[`/guides/my-tours/${bookingId}`]}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/guides/my-tours/:bookingId" element={<TourDetailPage />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

const confirmedTour: AssignedTourDto = {
  bookingId: 'booking-1',
  startDate: '2026-05-01',
  endDate: '2026-05-05',
  groupSize: 4,
  status: 'Confirmed',
  tourPackageId: 'pkg-1',
  tourPackageName: 'Sri Lanka Highlands',
  theme: 'Adventure',
  locations: ['Ella', 'Kandy'],
  specialRequests: 'Vegetarian meals please',
  guideId: 'guide-1',
  guideName: 'Kasun Perera',
  attended: false,
  completed: false,
  guideNotes: null,
};

describe('TourDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetItinerary.mockResolvedValue([]);
  });

  it('shows tour details including special requests', async () => {
    mockedGetMyAssignedTours.mockResolvedValue([confirmedTour]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Sri Lanka Highlands')).toBeInTheDocument();
    });
    expect(screen.getByText(/Vegetarian meals please/)).toBeInTheDocument();
    expect(screen.getByText(/Ella, Kandy/)).toBeInTheDocument();
  });

  it('Completed checkbox is absent and Attended control remains', async () => {
    mockedGetMyAssignedTours.mockResolvedValue([confirmedTour]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Sri Lanka Highlands')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('Completed')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Attended')).toBeInTheDocument();
  });

  it('saves attendance and notes without manual completed', async () => {
    const user = userEvent.setup();
    mockedGetMyAssignedTours.mockResolvedValue([confirmedTour]);
    mockedUpdateGuideTour.mockResolvedValue({ ...confirmedTour, attended: true, guideNotes: 'All good' });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Sri Lanka Highlands')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Attended'));
    await user.type(screen.getByLabelText('Guide Notes'), 'All good');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedUpdateGuideTour).toHaveBeenCalledWith('booking-1', {
        attended: true,
        notes: 'All good',
      });
    });
    expect(screen.getByText('Tour updates saved.')).toBeInTheDocument();
  });

  it('renders Not Started status and neither Start Tour nor End Tour button is rendered', async () => {
    mockedGetMyAssignedTours.mockResolvedValue([confirmedTour]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Not Started')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /start tour/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /end tour/i })).not.toBeInTheDocument();
  });

  it('renders In Progress status with started at timestamp and no lifecycle action buttons', async () => {
    mockedGetMyAssignedTours.mockResolvedValue([
      {
        ...confirmedTour,
        tourStartedAt: '2026-05-01T09:00:00Z',
      },
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });
    expect(screen.getByText(/Started at:/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start tour/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /end tour/i })).not.toBeInTheDocument();
  });

  it('renders Completed status with started at and ended at timestamps and no lifecycle action buttons', async () => {
    mockedGetMyAssignedTours.mockResolvedValue([
      {
        ...confirmedTour,
        tourStartedAt: '2026-05-01T09:00:00Z',
        tourEndedAt: '2026-05-05T18:00:00Z',
        completed: true,
      },
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
    expect(screen.getByText(/Started at:/i)).toBeInTheDocument();
    expect(screen.getByText(/Ended at:/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start tour/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /end tour/i })).not.toBeInTheDocument();
  });

  it('shows the itinerary for a confirmed booking', async () => {
    mockedGetMyAssignedTours.mockResolvedValue([confirmedTour]);
    const steps: ItineraryStepDto[] = [
      { id: 's1', bookingId: 'booking-1', dayNumber: 1, activity: 'City tour', location: 'Kandy', startTime: '09:00:00' },
    ];
    mockedGetItinerary.mockResolvedValue(steps);
    renderPage();

    await waitFor(() => {
      expect(mockedGetItinerary).toHaveBeenCalledWith('booking-1');
    });
    await waitFor(() => {
      expect(screen.getByText('City tour', { exact: false })).toBeInTheDocument();
    });
    expect(screen.getByText('Day 1')).toBeInTheDocument();
  });

  it('hides the itinerary form for a non-confirmed booking', async () => {
    mockedGetMyAssignedTours.mockResolvedValue([{ ...confirmedTour, status: 'PendingApproval' }]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Sri Lanka Highlands')).toBeInTheDocument();
    });
    expect(screen.getByText('Available once this booking is confirmed.')).toBeInTheDocument();
    expect(mockedGetItinerary).not.toHaveBeenCalled();
  });

  it('shows an error when the tour is not assigned to the current guide', async () => {
    mockedGetMyAssignedTours.mockResolvedValue([]);
    renderPage('booking-unknown');

    await waitFor(() => {
      expect(screen.getByText('This tour is not assigned to you.')).toBeInTheDocument();
    });
  });
});
