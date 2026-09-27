import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getGuideAvailability,
  getGuides,
  updateGuideAvailability,
  type GuideAvailabilityDto,
  type GuideDto,
} from '../../api/guides';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import type { CurrentUser } from '../../auth/types';
import { GuideAvailabilityPage } from './GuideAvailabilityPage';

vi.mock('../../api/guides', () => ({
  getGuides: vi.fn(),
  getGuideAvailability: vi.fn(),
  updateGuideAvailability: vi.fn(),
}));

const mockedGetGuides = vi.mocked(getGuides);
const mockedGetGuideAvailability = vi.mocked(getGuideAvailability);
const mockedUpdateGuideAvailability = vi.mocked(updateGuideAvailability);

const sampleGuides: GuideDto[] = [
  {
    id: 'guide-1',
    name: 'Kasun Perera',
    languages: ['English', 'Sinhala'],
    specializations: ['Wildlife', 'Hiking'],
    contactInfo: '+94771234567',
    userId: 'user-guide-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'guide-2',
    name: 'Nimal Silva',
    languages: ['English', 'German'],
    specializations: ['Cultural', 'Historical'],
    contactInfo: '+94777654321',
    userId: 'user-guide-2',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

function renderWithAuth(currentUser: CurrentUser) {
  const authValue: AuthContextValue = {
    user: currentUser,
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
        <GuideAvailabilityPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('GuideAvailabilityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetGuides.mockResolvedValue(sampleGuides);
    mockedGetGuideAvailability.mockResolvedValue([]);
    mockedUpdateGuideAvailability.mockResolvedValue([]);
  });

  it('calendar renders the selected month', async () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIndex = today.getMonth();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const expectedMonthHeader = `${monthNames[currentMonthIndex]} ${currentYear}`;

    renderWithAuth({
      id: 'ops-1',
      name: 'Ops Manager',
      email: 'ops@example.com',
      contactNumber: '+123456',
      role: 'OperationsManager',
    });

    await waitFor(() => {
      expect(screen.getByTestId('month-title')).toHaveTextContent(expectedMonthHeader);
    });

    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Booked')).toBeInTheDocument();
  });

  it('OperationsManager and FleetCoordinator can switch guide selection', async () => {
    const user = userEvent.setup();

    renderWithAuth({
      id: 'ops-1',
      name: 'Ops User',
      email: 'ops@example.com',
      contactNumber: '+123456',
      role: 'OperationsManager',
    });

    await waitFor(() => {
      expect(screen.getByTestId('guide-select')).toBeInTheDocument();
    });

    const select = screen.getByTestId('guide-select') as HTMLSelectElement;
    expect(select.value).toBe('guide-1');

    await user.selectOptions(select, 'guide-2');
    expect(select.value).toBe('guide-2');

    await waitFor(() => {
      expect(mockedGetGuideAvailability).toHaveBeenCalledWith(
        'guide-2',
        expect.any(String),
        expect.any(String),
      );
    });
  });

  it('TourGuide sees only their linked guide and no guide dropdown', async () => {
    renderWithAuth({
      id: 'user-guide-1',
      name: 'Kasun Perera',
      email: 'kasun@example.com',
      contactNumber: '+94771234567',
      role: 'TourGuide',
    });

    await waitFor(() => {
      expect(screen.getByText('Your Guide Profile')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('guide-select')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kasun Perera' })).toBeInTheDocument();
    expect(mockedGetGuideAvailability).toHaveBeenCalledWith(
      'guide-1',
      expect.any(String),
      expect.any(String),
    );
  });

  it('TourGuide with no linked profile shows a clear error message', async () => {
    renderWithAuth({
      id: 'unlinked-tourguide',
      name: 'Unlinked Guide',
      email: 'unlinked@example.com',
      contactNumber: '+94770000000',
      role: 'TourGuide',
    });

    await waitFor(() => {
      expect(screen.getByTestId('no-linked-guide-error')).toBeInTheDocument();
    });

    expect(screen.getByText(/no guide profile linked/i)).toBeInTheDocument();
  });

  it('missing availability row renders as Available by default', async () => {
    // Empty availability array returned
    mockedGetGuideAvailability.mockResolvedValue([]);

    renderWithAuth({
      id: 'ops-1',
      name: 'Ops Manager',
      email: 'ops@example.com',
      contactNumber: '+123456',
      role: 'OperationsManager',
    });

    await waitFor(() => {
      expect(screen.getByTestId('month-title')).toBeInTheDocument();
    });

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day1Key = `${year}-${month}-01`;

    const day1Element = screen.getByTestId(`day-${day1Key}`);
    expect(day1Element).toHaveAttribute('data-status', 'available');
    expect(day1Element).toHaveTextContent('Available');
  });

  it('unavailable row renders correctly', async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day5Key = `${year}-${month}-05`;

    const availabilityData: GuideAvailabilityDto[] = [
      {
        id: 'avail-1',
        guideId: 'guide-1',
        date: day5Key,
        isAvailable: false,
        assignedBookingId: null,
      },
    ];

    mockedGetGuideAvailability.mockResolvedValue(availabilityData);

    renderWithAuth({
      id: 'ops-1',
      name: 'Ops Manager',
      email: 'ops@example.com',
      contactNumber: '+123456',
      role: 'OperationsManager',
    });

    await waitFor(() => {
      expect(screen.getByTestId(`day-${day5Key}`)).toHaveAttribute('data-status', 'unavailable');
    });

    const day5Element = screen.getByTestId(`day-${day5Key}`);
    expect(day5Element).toHaveTextContent('Unavailable');
  });

  it('booked row renders as Booked and cannot be toggled', async () => {
    const user = userEvent.setup();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day10Key = `${year}-${month}-10`;

    const availabilityData: GuideAvailabilityDto[] = [
      {
        id: 'avail-booked',
        guideId: 'guide-1',
        date: day10Key,
        isAvailable: false,
        assignedBookingId: 'booking-999',
      },
    ];

    mockedGetGuideAvailability.mockResolvedValue(availabilityData);

    renderWithAuth({
      id: 'user-guide-1',
      name: 'Kasun Perera',
      email: 'kasun@example.com',
      contactNumber: '+94771234567',
      role: 'TourGuide',
    });

    await waitFor(() => {
      expect(screen.getByTestId(`day-${day10Key}`)).toHaveAttribute('data-status', 'booked');
    });

    const day10Element = screen.getByTestId(`day-${day10Key}`);
    expect(day10Element).toHaveTextContent('Booked');

    // Click booked day
    await user.click(day10Element);

    // Should NOT call updateGuideAvailability
    expect(mockedUpdateGuideAvailability).not.toHaveBeenCalled();

    // Should show explanation that booked dates cannot be changed
    expect(screen.getByText(new RegExp(`Date ${day10Key} is booked and cannot be changed`, 'i'))).toBeInTheDocument();
  });

  it('TourGuide clicking an available date sends PUT with isAvailable = false', async () => {
    const user = userEvent.setup();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day12Key = `${year}-${month}-12`;

    mockedGetGuideAvailability.mockResolvedValue([]);
    mockedUpdateGuideAvailability.mockResolvedValue([
      {
        id: 'avail-updated',
        guideId: 'guide-1',
        date: day12Key,
        isAvailable: false,
        assignedBookingId: null,
      },
    ]);

    renderWithAuth({
      id: 'user-guide-1',
      name: 'Kasun Perera',
      email: 'kasun@example.com',
      contactNumber: '+94771234567',
      role: 'TourGuide',
    });

    await waitFor(() => {
      expect(screen.getByTestId(`day-${day12Key}`)).toBeInTheDocument();
    });

    const day12Element = screen.getByTestId(`day-${day12Key}`);
    expect(day12Element).toHaveAttribute('data-status', 'available');

    await user.click(day12Element);

    expect(mockedUpdateGuideAvailability).toHaveBeenCalledWith('guide-1', {
      dates: [{ date: day12Key, isAvailable: false }],
    });

    // Immediate UI update
    await waitFor(() => {
      expect(screen.getByTestId(`day-${day12Key}`)).toHaveAttribute('data-status', 'unavailable');
    });
  });

  it('TourGuide clicking an unavailable date sends PUT with isAvailable = true', async () => {
    const user = userEvent.setup();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day15Key = `${year}-${month}-15`;

    mockedGetGuideAvailability.mockResolvedValue([
      {
        id: 'avail-unavail',
        guideId: 'guide-1',
        date: day15Key,
        isAvailable: false,
        assignedBookingId: null,
      },
    ]);
    mockedUpdateGuideAvailability.mockResolvedValue([
      {
        id: 'avail-now-avail',
        guideId: 'guide-1',
        date: day15Key,
        isAvailable: true,
        assignedBookingId: null,
      },
    ]);

    renderWithAuth({
      id: 'user-guide-1',
      name: 'Kasun Perera',
      email: 'kasun@example.com',
      contactNumber: '+94771234567',
      role: 'TourGuide',
    });

    await waitFor(() => {
      expect(screen.getByTestId(`day-${day15Key}`)).toHaveAttribute('data-status', 'unavailable');
    });

    const day15Element = screen.getByTestId(`day-${day15Key}`);
    await user.click(day15Element);

    expect(mockedUpdateGuideAvailability).toHaveBeenCalledWith('guide-1', {
      dates: [{ date: day15Key, isAvailable: true }],
    });

    // Immediate UI update to available
    await waitFor(() => {
      expect(screen.getByTestId(`day-${day15Key}`)).toHaveAttribute('data-status', 'available');
    });
  });

  it('non-TourGuide users cannot toggle dates', async () => {
    const user = userEvent.setup();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day18Key = `${year}-${month}-18`;

    mockedGetGuideAvailability.mockResolvedValue([]);

    renderWithAuth({
      id: 'fleet-1',
      name: 'Fleet Coord',
      email: 'fleet@example.com',
      contactNumber: '+123456',
      role: 'FleetCoordinator',
    });

    await waitFor(() => {
      expect(screen.getByTestId(`day-${day18Key}`)).toBeInTheDocument();
    });

    const day18Element = screen.getByTestId(`day-${day18Key}`);
    expect(day18Element).toBeDisabled();

    await user.click(day18Element);
    expect(mockedUpdateGuideAvailability).not.toHaveBeenCalled();
  });

  it('navigating months triggers availability fetch for new month', async () => {
    const user = userEvent.setup();

    renderWithAuth({
      id: 'ops-1',
      name: 'Ops Manager',
      email: 'ops@example.com',
      contactNumber: '+123456',
      role: 'OperationsManager',
    });

    await waitFor(() => {
      expect(screen.getByTestId('next-month-button')).toBeInTheDocument();
    });

    mockedGetGuideAvailability.mockClear();

    await user.click(screen.getByTestId('next-month-button'));

    await waitFor(() => {
      expect(mockedGetGuideAvailability).toHaveBeenCalledTimes(1);
    });
  });
});
