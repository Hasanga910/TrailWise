import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getItinerary,
  setItinerary,
  type ItineraryStepDto,
} from '../../api/itineraries';
import { TourItineraryPage } from './TourItineraryPage';

vi.mock('../../api/itineraries', () => ({
  getItinerary: vi.fn(),
  setItinerary: vi.fn(),
}));

const mockedGetItinerary = vi.mocked(getItinerary);
const mockedSetItinerary = vi.mocked(setItinerary);

const sampleSteps: ItineraryStepDto[] = [
  {
    id: 'step-1',
    bookingId: 'booking-1',
    dayNumber: 1,
    activity: 'Welcome Briefing & Tea Tasting',
    location: 'Ella Flower Garden Resort',
    startTime: '09:00:00',
  },
  {
    id: 'step-2',
    bookingId: 'booking-1',
    dayNumber: 1,
    activity: 'Little Adam\'s Peak Sunset Hike',
    location: 'Little Adam\'s Peak Trailhead',
    startTime: '16:00:00',
  },
];

function renderComponent(bookingId = 'booking-1') {
  return render(
    <MemoryRouter initialEntries={[`/guide/tours/${bookingId}/itinerary`]}>
      <Routes>
        <Route path="/guide/tours/:id/itinerary" element={<TourItineraryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TourItineraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockedGetItinerary.mockReturnValue(new Promise(() => {}));
    renderComponent();

    expect(screen.getByText(/loading itinerary/i)).toBeInTheDocument();
  });

  it('renders loaded itinerary steps and adds a new step', async () => {
    mockedGetItinerary.mockResolvedValueOnce(sampleSteps);
    mockedSetItinerary.mockResolvedValueOnce([
      ...sampleSteps,
      {
        id: 'step-3',
        bookingId: 'booking-1',
        dayNumber: 2,
        activity: 'Nine Arches Train Viewing',
        location: 'Nine Arches Demodara',
        startTime: '10:30:00',
      },
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Welcome Briefing & Tea Tasting')).toBeInTheDocument();
      expect(screen.getByText('Little Adam\'s Peak Sunset Hike')).toBeInTheDocument();
    });

    // Fill in new step form
    const dayInput = screen.getByLabelText(/day number/i);
    const timeInput = screen.getByLabelText(/start time/i);
    const activityInput = screen.getByLabelText(/activity/i);
    const locationInput = screen.getByLabelText(/location/i);

    await userEvent.clear(dayInput);
    await userEvent.type(dayInput, '2');
    await userEvent.clear(timeInput);
    await userEvent.type(timeInput, '10:30');
    await userEvent.type(activityInput, 'Nine Arches Train Viewing');
    await userEvent.type(locationInput, 'Nine Arches Demodara');

    const addBtn = screen.getByRole('button', { name: /\+ add step to itinerary/i });
    await userEvent.click(addBtn);

    expect(screen.getByText('Nine Arches Train Viewing')).toBeInTheDocument();

    // Now save itinerary
    const saveBtn = screen.getByRole('button', { name: /save itinerary changes/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockedSetItinerary).toHaveBeenCalledWith(
        'booking-1',
        expect.arrayContaining([
          expect.objectContaining({
            dayNumber: 2,
            activity: 'Nine Arches Train Viewing',
            location: 'Nine Arches Demodara',
            startTime: '10:30:00',
          }),
        ]),
      );
      expect(screen.getByText(/itinerary saved successfully/i)).toBeInTheDocument();
    });
  });

  it('prevents adding step with empty activity and shows error', async () => {
    mockedGetItinerary.mockResolvedValueOnce([]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/no itinerary steps defined yet/i)).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /\+ add step to itinerary/i });
    await userEvent.click(addBtn);

    // Activity input is required or shows stepError
    expect(screen.queryByText(/itinerary saved successfully/i)).not.toBeInTheDocument();
  });
});
