import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAssignedTours,
  updateGuideTour,
  type AssignedTourDto,
} from '../../api/guides';
import { AssignedTourDetailPage } from './AssignedTourDetailPage';

vi.mock('../../api/guides', () => ({
  getAssignedTours: vi.fn(),
  updateGuideTour: vi.fn(),
}));

const mockedGetAssignedTours = vi.mocked(getAssignedTours);
const mockedUpdateGuideTour = vi.mocked(updateGuideTour);

const sampleTour: AssignedTourDto = {
  bookingId: 'booking-1',
  startDate: '2026-10-01',
  endDate: '2026-10-05',
  groupSize: 4,
  status: 'Confirmed',
  tourPackageId: 'pkg-1',
  tourPackageName: 'Ella Adventure Trek',
  theme: 'Adventure',
  locations: ['Ella Rock', 'Nine Arches Bridge'],
  specialRequests: 'Vegetarian meals preferred',
  guideId: 'guide-1',
  guideName: 'Kasun Perera',
  attended: false,
  completed: false,
  guideNotes: 'Initial note',
};

function renderComponent(bookingId = 'booking-1') {
  return render(
    <MemoryRouter initialEntries={[`/guide/tours/${bookingId}`]}>
      <Routes>
        <Route path="/guide/tours/:id" element={<AssignedTourDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AssignedTourDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tour information correctly', async () => {
    mockedGetAssignedTours.mockResolvedValueOnce([sampleTour]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ella Adventure Trek')).toBeInTheDocument();
    });

    expect(screen.getByText('Adventure')).toBeInTheDocument();
    expect(screen.getByText('2026-10-01 to 2026-10-05')).toBeInTheDocument();
    expect(screen.getByText('4 travelers')).toBeInTheDocument();
    expect(screen.getByText('Ella Rock, Nine Arches Bridge')).toBeInTheDocument();
    expect(screen.getByText('Vegetarian meals preferred')).toBeInTheDocument();
    expect(screen.getByLabelText(/guide notes/i)).toHaveValue('Initial note');
  });

  it('updates attended, completed, and notes via PATCH on submit', async () => {
    mockedGetAssignedTours.mockResolvedValueOnce([sampleTour]);
    mockedUpdateGuideTour.mockResolvedValueOnce({
      ...sampleTour,
      attended: true,
      completed: true,
      guideNotes: 'Group arrived on time, completed hike safely.',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ella Adventure Trek')).toBeInTheDocument();
    });

    const attendedCheckbox = screen.getByLabelText(/attended/i);
    const completedCheckbox = screen.getByLabelText(/completed/i);
    const notesInput = screen.getByLabelText(/guide notes/i);

    expect(attendedCheckbox).not.toBeChecked();
    expect(completedCheckbox).not.toBeChecked();

    await userEvent.click(attendedCheckbox);
    await userEvent.click(completedCheckbox);
    await userEvent.clear(notesInput);
    await userEvent.type(notesInput, 'Group arrived on time, completed hike safely.');

    const saveBtn = screen.getByRole('button', { name: /save updates/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockedUpdateGuideTour).toHaveBeenCalledWith('booking-1', {
        attended: true,
        completed: true,
        notes: 'Group arrived on time, completed hike safely.',
      });
      expect(screen.getByText(/tour updates saved successfully/i)).toBeInTheDocument();
    });
  });

  it('displays error alert when updateGuideTour fails', async () => {
    mockedGetAssignedTours.mockResolvedValueOnce([sampleTour]);
    mockedUpdateGuideTour.mockRejectedValueOnce(new Error('Update failed on server'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ella Adventure Trek')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /save updates/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/failed to save tour updates/i)).toBeInTheDocument();
    });
  });
});
