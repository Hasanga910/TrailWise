import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAssignedTours, type AssignedTourDto } from '../../api/guides';
import { AssignedToursPage } from './AssignedToursPage';

vi.mock('../../api/guides', () => ({
  getAssignedTours: vi.fn(),
}));

const mockedGetAssignedTours = vi.mocked(getAssignedTours);

const sampleTours: AssignedTourDto[] = [
  {
    bookingId: 'booking-1',
    startDate: '2026-10-01',
    endDate: '2026-10-05',
    groupSize: 4,
    status: 'Confirmed',
    tourPackageId: 'pkg-1',
    tourPackageName: 'Ella Adventure Trek',
    theme: 'Adventure',
    locations: ['Ella Rock', 'Nine Arches Bridge'],
    specialRequests: 'Vegetarian meals',
    guideId: 'guide-1',
    guideName: 'Kasun Perera',
    attended: false,
    completed: false,
    guideNotes: null,
  },
  {
    bookingId: 'booking-2',
    startDate: '2026-10-10',
    endDate: '2026-10-12',
    groupSize: 2,
    status: 'Completed',
    tourPackageId: 'pkg-2',
    tourPackageName: 'Galle Coastal Tour',
    theme: 'Coastal',
    locations: ['Galle Fort'],
    specialRequests: null,
    guideId: 'guide-1',
    guideName: 'Kasun Perera',
    attended: true,
    completed: true,
    guideNotes: 'All visited on time.',
  },
];

describe('AssignedToursPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockedGetAssignedTours.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <AssignedToursPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/loading assigned tours/i)).toBeInTheDocument();
  });

  it('renders error state and retries on click', async () => {
    mockedGetAssignedTours
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(sampleTours);

    render(
      <MemoryRouter>
        <AssignedToursPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/unable to load tours/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Ella Adventure Trek')).toBeInTheDocument();
    });
  });

  it('renders empty state when no tours are assigned', async () => {
    mockedGetAssignedTours.mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <AssignedToursPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no assigned tours found/i)).toBeInTheDocument();
    });
  });

  it('renders tour cards with package, dates, status, locations, and group size', async () => {
    mockedGetAssignedTours.mockResolvedValueOnce(sampleTours);

    render(
      <MemoryRouter>
        <AssignedToursPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Ella Adventure Trek')).toBeInTheDocument();
      expect(screen.getByText('Galle Coastal Tour')).toBeInTheDocument();
    });

    expect(screen.getByText('2026-10-01 to 2026-10-05')).toBeInTheDocument();
    expect(screen.getByText('4 travelers')).toBeInTheDocument();
    expect(screen.getByText('Ella Rock, Nine Arches Bridge')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });
});
