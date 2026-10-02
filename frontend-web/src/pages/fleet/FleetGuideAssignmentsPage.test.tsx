import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bookingsApi from '../../api/bookings';
import type { AvailableGuideDto, BookingSummaryDto } from '../../api/bookings';
import { FleetGuideAssignmentsPage } from './FleetGuideAssignmentsPage';

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

  it('renders NeedsManualReview bookings with useful details', async () => {
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
    expect(screen.getByText('NeedsManualReview')).toBeInTheDocument();

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

  it('selects a guide, confirms assignment, confirms booking and removes it from pending list', async () => {
    vi.spyOn(bookingsApi, 'getAllBookings')
      .mockResolvedValueOnce([sampleBooking()])
      .mockResolvedValueOnce([sampleBooking({ status: 'Confirmed' })]);

    vi.spyOn(bookingsApi, 'getAvailableGuidesForBooking').mockResolvedValue(mockGuides);
    const assignSpy = vi.spyOn(bookingsApi, 'assignGuide').mockResolvedValue({
      bookingId: 'booking-review-1234',
      guideId: 'guide-101',
      status: 'Confirmed',
    });

    render(<FleetGuideAssignmentsPage />);
    await screen.findByText('Sarah Connor');

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

    expect(await screen.findByText(/Tour Guide successfully assigned/i)).toBeInTheDocument();
    // Booking list reloaded and empty
    expect(await screen.findByText(/no pending guide assignments/i)).toBeInTheDocument();
  });

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
    expect(await screen.findByText(/selected guide is no longer available/i)).toBeInTheDocument();
    // Modal reloaded available guides
    expect(guidesSpy).toHaveBeenCalledTimes(2);

    // Cancel modal
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    // Booking still exists with NeedsManualReview
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('NeedsManualReview')).toBeInTheDocument();
  });
});
