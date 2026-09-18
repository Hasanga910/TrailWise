import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBooking } from '../../api/bookings';
import { getPackages, type TourPackage } from '../../api/packages';
import { BookingRequestPage } from './BookingRequestPage';

vi.mock('../../api/packages', () => ({
  getPackages: vi.fn(),
}));

vi.mock('../../api/bookings', () => ({
  createBooking: vi.fn(),
}));

const mockedGetPackages = vi.mocked(getPackages);
const mockedCreateBooking = vi.mocked(createBooking);

const SAMPLE_PACKAGES: TourPackage[] = [
  {
    id: 'pkg-1',
    name: 'Cultural Triangle Explorer',
    theme: 'Cultural',
    durationDays: 4,
    basePricePerPerson: 250,
    maxGroupSize: 12,
    photoUrl: null,
    tiers: [
      { id: 'tier-1', classType: 'Normal', includesFood: false, basePricePerPerson: 250, requiresAC: false },
    ],
    locations: [],
  },
];

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/traveler/bookings/new']}>
      <Routes>
        <Route path="/traveler/bookings/new" element={<BookingRequestPage />} />
        <Route path="/traveler/bookings" element={<div>My Bookings Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillValidFieldsExceptBudget(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/package tier/i), 'tier-1');
  await user.type(screen.getByLabelText(/start date/i), '2030-01-01');
  await user.type(screen.getByLabelText(/end date/i), '2030-01-05');
  await user.clear(screen.getByLabelText(/group size/i));
  await user.type(screen.getByLabelText(/group size/i), '2');
}

describe('BookingRequestPage', () => {
  beforeEach(() => {
    mockedGetPackages.mockResolvedValue(SAMPLE_PACKAGES);
    mockedCreateBooking.mockReset();
  });

  it('does not call createBooking when budget is left at 0', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/Cultural Triangle Explorer/);
    await fillValidFieldsExceptBudget(user);

    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(mockedCreateBooking).not.toHaveBeenCalled();
  });

  it('submits the form and navigates to My Bookings on success', async () => {
    mockedCreateBooking.mockResolvedValue({
      id: 'booking-1',
      travelerId: 'traveler-1',
      tourPackageId: 'pkg-1',
      tourPackageName: 'Cultural Triangle Explorer',
      packageTier: { id: 'tier-1', classType: 'Normal', includesFood: false, basePricePerPerson: 250, requiresAC: false },
      groupSize: 2,
      startDate: '2030-01-01',
      endDate: '2030-01-05',
      budgetPerPerson: 300,
      status: 'Requested',
      isLargeGroup: false,
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/Cultural Triangle Explorer/);
    await fillValidFieldsExceptBudget(user);
    await user.clear(screen.getByLabelText(/budget per person/i));
    await user.type(screen.getByLabelText(/budget per person/i), '300');

    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(await screen.findByText('My Bookings Page')).toBeInTheDocument();
    expect(mockedCreateBooking).toHaveBeenCalledWith({
      packageTierId: 'tier-1',
      groupSize: 2,
      startDate: '2030-01-01',
      endDate: '2030-01-05',
      budgetPerPerson: 300,
    });
  });

  it('renders backend field errors next to the corresponding inputs', async () => {
    mockedCreateBooking.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          errors: [{ field: 'groupSize', message: 'Group size cannot exceed 12 for this package.' }],
        },
      },
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/Cultural Triangle Explorer/);
    await fillValidFieldsExceptBudget(user);
    await user.clear(screen.getByLabelText(/budget per person/i));
    await user.type(screen.getByLabelText(/budget per person/i), '300');

    await user.click(screen.getByRole('button', { name: /submit request/i }));

    expect(await screen.findByText('Group size cannot exceed 12 for this package.')).toBeInTheDocument();
  });
});
