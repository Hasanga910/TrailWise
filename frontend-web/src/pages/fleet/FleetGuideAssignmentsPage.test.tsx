import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bookingsApi from '../../api/bookings';
import type { AvailableGuideDto, BookingSummaryDto } from '../../api/bookings';
import { FleetGuideAssignmentsPage } from './FleetGuideAssignmentsPage';
import { notify } from '../../components/ui/notify';

vi.mock('../../components/ui/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function sampleBooking(overrides: Partial<BookingSummaryDto> = {}): BookingSummaryDto {
  return {
    id: 'booking-review-1234',
    travelerName: 'Sarah Connor',
    packageName: 'Highland Tea & Mist Explorer',
    status: 'NeedsManualReview',
    createdAt: '2026-11-01T00:00:00Z',
    startDate: '2026-12-01',
    endDate: '2026-12-05',
    groupSize: 4,
    languagePreference: 'German',
    assignedGuide: null,
    ...overrides,
  };
}

const mockGuides: AvailableGuideDto[] = [
  {
    guideId: 'guide-101',
    name: 'Ruwan Perera',
    languages: ['English', 'German'],
    specializations: ['Highland Nature', 'Tea Culture'],
    contactInfo: '+94 77 987 6543',
    matchesSpecialization: true,
    matchesLanguage: true,
    notes: 'Expert in Highland trails and fluent in German',
  },
  {
    guideId: 'guide-102',
    name: 'Anil Fernando',
    languages: ['English'],
    specializations: ['Wildlife Safari'],
    contactInfo: '+94 71 234 5678',
    matchesSpecialization: false,
    matchesLanguage: false,
    notes: null,
  },
];

describe('FleetGuideAssignmentsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. NeedsManualReview + no assigned guide -> Assign Tour Guide visible
  it('renders NeedsManualReview booking with no assigned guide with "Assign Tour Guide" button', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking(),
      sampleBooking({ id: 'booking-confirmed-9999', status: 'Confirmed', travelerName: 'John Doe' }),
    ]);

    render(<FleetGuideAssignmentsPage />);

    expect(screen.getByRole('heading', { name: /guide assignment fallback/i })).toBeInTheDocument();
    expect(await screen.findByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('Highland Tea & Mist Explorer')).toBeInTheDocument();
    expect(screen.getByText('2026-12-01 → 2026-12-05')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('German')).toBeInTheDocument();
    expect(screen.getByText('Needs Manual Review')).toBeInTheDocument();

    // Pending count
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 1 pending assignments/i)).toBeInTheDocument();

    // Confirmed booking should NOT be in the table
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();

    // Action button
    expect(screen.getByRole('button', { name: /assign tour guide/i })).toBeInTheDocument();
  });

  it('shows empty state when no bookings need manual review', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({ id: 'booking-c-1', status: 'Confirmed' }),
    ]);

    render(<FleetGuideAssignmentsPage />);

    expect(await screen.findByText(/no pending guide assignments/i)).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  // 4. NeedsManualReview + guide already assigned -> Assign Tour Guide NOT visible
  it('does NOT show "Assign Tour Guide" button or pending review count when NeedsManualReview booking already has an assigned guide', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([
      sampleBooking({
        id: 'booking-review-already-guided',
        status: 'NeedsManualReview',
        assignedGuide: {
          id: 'guide-101',
          name: 'Ruwan Perera',
          languages: ['English', 'German'],
          specializations: ['Highland Nature'],
          contactInfo: '+94 77 987 6543',
        },
      }),
    ]);

    render(<FleetGuideAssignmentsPage />);

    expect(await screen.findByText(/no pending guide assignments/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign tour guide/i })).not.toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/Showing 0 of 0 pending assignments/i)).toBeInTheDocument();
  });

  it('opens guide assignment modal, fetches available guides, and displays guide attributes', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([sampleBooking()]);
    const guidesSpy = vi.spyOn(bookingsApi, 'getAvailableGuidesForBooking').mockResolvedValue(mockGuides);

    render(<FleetGuideAssignmentsPage />);
    await screen.findByText('Sarah Connor');

    await userEvent.click(screen.getByRole('button', { name: /assign tour guide/i }));

    expect(await screen.findByText('Ruwan Perera')).toBeInTheDocument();
    expect(screen.getByText('Anil Fernando')).toBeInTheDocument();
    expect(screen.getByText(/Highland Nature, Tea Culture/)).toBeInTheDocument();
    expect(screen.getByText('Theme Match')).toBeInTheDocument();
    expect(screen.getByText('Language Match')).toBeInTheDocument();
    expect(screen.getByText(/Expert in Highland trails/)).toBeInTheDocument();
    expect(guidesSpy).toHaveBeenCalledWith('booking-review-1234');
  });

  // 2 & 3. successful assignment -> modal closes, booking refresh occurs, pending list & counts update immediately
  it('selects a guide, confirms assignment, immediately removes booking from pending list, and updates counts', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings')
      .mockResolvedValueOnce([sampleBooking()])
      .mockResolvedValueOnce([
        sampleBooking({
          status: 'NeedsManualReview', // e.g. stayed NeedsManualReview awaiting vehicle/driver, but now has guide
          assignedGuide: {
            id: 'guide-101',
            name: 'Ruwan Perera',
            languages: ['English'],
            specializations: ['Highland Nature'],
          },
        }),
      ]);

    vi.spyOn(bookingsApi, 'getAvailableGuidesForBooking').mockResolvedValue(mockGuides);
    const assignSpy = vi.spyOn(bookingsApi, 'assignGuide').mockResolvedValue({
      bookingId: 'booking-review-1234',
      guideId: 'guide-101',
      status: 'NeedsManualReview',
    });

    render(<FleetGuideAssignmentsPage />);
    await screen.findByText('Sarah Connor');
    expect(screen.getByText(/Showing 1 of 1 pending assignments/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /assign tour guide/i }));
    await screen.findByText('Ruwan Perera');

    // Select first guide
    const radios = screen.getAllByRole('radio');
    await userEvent.click(radios[0]);

    // Click Assign Guide to prompt confirmation
    await userEvent.click(screen.getByRole('button', { name: /^assign guide$/i }));

    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName?.toLowerCase() === 'p' &&
          (el?.textContent?.includes('Assign Ruwan Perera to this booking?') ?? false),
      ),
    ).toBeInTheDocument();

    // Confirm assignment
    await userEvent.click(screen.getByRole('button', { name: /confirm assignment/i }));

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith('booking-review-1234', 'guide-101');
    });

    // Success notification shown
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith(expect.stringMatching(/Tour Guide successfully assigned/i)));
    // Modal is closed
    expect(screen.queryByRole('heading', { name: /assign tour guide/i })).not.toBeInTheDocument();
    // Booking list updated: assigned booking disappears from pending list and button is gone
    expect(await screen.findByText(/no pending guide assignments/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign tour guide/i })).not.toBeInTheDocument();
    // Pending count updated to 0
    expect(screen.getByText(/Showing 0 of 0 pending assignments/i)).toBeInTheDocument();
  });

  // 5. double-click / second assignment prevented while assigning
  it('disables confirmation button while assignment is processing to prevent double-click', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([sampleBooking()]);
    vi.spyOn(bookingsApi, 'getAvailableGuidesForBooking').mockResolvedValue(mockGuides);

    let resolveAssignment: (value: any) => void;
    const assignmentPromise = new Promise((resolve) => {
      resolveAssignment = resolve;
    });
    vi.spyOn(bookingsApi, 'assignGuide').mockReturnValue(assignmentPromise as any);

    render(<FleetGuideAssignmentsPage />);
    await screen.findByText('Sarah Connor');

    await userEvent.click(screen.getByRole('button', { name: /assign tour guide/i }));
    await screen.findByText('Ruwan Perera');

    const radios = screen.getAllByRole('radio');
    await userEvent.click(radios[0]);
    await userEvent.click(screen.getByRole('button', { name: /^assign guide$/i }));

    const confirmBtn = screen.getByRole('button', { name: /confirm assignment/i });
    await userEvent.click(confirmBtn);

    // Button should now be disabled and text changed to Assigning...
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByText(/Assigning.../i)).toBeInTheDocument();

    // Resolve assignment
    resolveAssignment!({
      bookingId: 'booking-review-1234',
      guideId: 'guide-101',
      status: 'Confirmed',
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /confirm assignment/i })).not.toBeInTheDocument();
    });
  });

  // 6. conflict still keeps booking available for retry only when it genuinely has no guide
  it('handles conflict by keeping booking in NeedsManualReview, showing error, and reloading available guides for retry', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings').mockResolvedValue([sampleBooking()]);
    const guidesSpy = vi.spyOn(bookingsApi, 'getAvailableGuidesForBooking').mockResolvedValue(mockGuides);
    const assignSpy = vi.spyOn(bookingsApi, 'assignGuide').mockRejectedValue(
      new Error('Selected guide is no longer available for this booking.'),
    );

    render(<FleetGuideAssignmentsPage />);
    await screen.findByText('Sarah Connor');

    await userEvent.click(screen.getByRole('button', { name: /assign tour guide/i }));
    await screen.findByText('Ruwan Perera');

    const radios = screen.getAllByRole('radio');
    await userEvent.click(radios[0]);
    await userEvent.click(screen.getByRole('button', { name: /^assign guide$/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm assignment/i }));

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith('booking-review-1234', 'guide-101');
    });

    // Conflict error message shown in modal
    await waitFor(() => expect(notify.error).toHaveBeenCalledWith(expect.stringMatching(/selected guide is no longer available/i)));
    // Modal reloaded available guides
    expect(guidesSpy).toHaveBeenCalledTimes(2);

    // Cancel modal
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    // Booking still exists with NeedsManualReview and no guide, so button remains
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('Needs Manual Review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /assign tour guide/i })).toBeInTheDocument();
  });
});
