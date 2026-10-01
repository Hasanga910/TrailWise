import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as agentWorkflowsApi from '../../api/agentWorkflows';
import type { AgentWorkflowDto } from '../../api/agentWorkflows';
import * as bookingsApi from '../../api/bookings';
import type { BookingDto } from '../../api/bookings';
import { AgentWorkflowPage } from './AgentWorkflowPage';

function sampleWorkflow(overrides: Partial<AgentWorkflowDto> = {}): AgentWorkflowDto {
  return {
    bookingId: 'booking-1',
    status: 'Completed',
    summaryText: 'This booking looks good.',
    advisoryFlags: ['Nothing unusual.'],
    startedAt: '2030-01-01T00:00:00Z',
    completedAt: '2030-01-01T00:00:05Z',
    steps: [
      { agentName: 'PreferenceExtractionAgent', durationMs: 640, output: { dietaryNotes: [] } },
      { agentName: 'ProposalSummaryAgent', durationMs: 2100, output: { summaryText: 'This booking looks good.' } },
    ],
    ...overrides,
  };
}

function sampleBooking(overrides: Partial<BookingDto> = {}): BookingDto {
  return {
    id: 'booking-1',
    travelerId: 'traveler-1',
    tourPackageId: 'package-1',
    tourPackageName: 'Cultural Triangle Explorer',
    packageTier: {
      id: 'tier-1',
      classType: 'Normal',
      includesFood: false,
      basePricePerPerson: 200,
      requiresAC: false,
    },
    groupSize: 2,
    startDate: '2030-02-01',
    endDate: '2030-02-04',
    budgetPerPerson: 500,
    status: 'Confirmed',
    isLargeGroup: false,
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/ops/bookings/booking-1/workflow']}>
      <Routes>
        <Route path="/ops/bookings/:bookingId/workflow" element={<AgentWorkflowPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AgentWorkflowPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(bookingsApi, 'getBookingById').mockResolvedValue(sampleBooking());
  });

  it('renders the summary card and steps in order', async () => {
    vi.spyOn(agentWorkflowsApi, 'getAgentWorkflow').mockResolvedValue(sampleWorkflow());

    renderPage();

    expect(await screen.findByText('This booking looks good.')).toBeInTheDocument();
    expect(screen.getByText('Nothing unusual.')).toBeInTheDocument();

    const steps = screen.getAllByText(/Agent$/);
    expect(steps.map((el) => el.textContent)).toEqual(['PreferenceExtractionAgent', 'ProposalSummaryAgent']);
  });

  it('shows a placeholder when summaryText is null', async () => {
    vi.spyOn(agentWorkflowsApi, 'getAgentWorkflow').mockResolvedValue(
      sampleWorkflow({ summaryText: null, advisoryFlags: [] }),
    );

    renderPage();

    expect(await screen.findByText(/summary not available yet/i)).toBeInTheDocument();
  });

  it('shows a "no agent activity" message on a 404', async () => {
    const notFoundError = { isAxiosError: true, response: { status: 404, data: {} } };
    vi.spyOn(agentWorkflowsApi, 'getAgentWorkflow').mockRejectedValue(notFoundError);

    renderPage();

    expect(await screen.findByText(/no agent activity recorded for this booking yet/i)).toBeInTheDocument();
  });

  it('shows an error banner with a retry button on other failures', async () => {
    vi.spyOn(agentWorkflowsApi, 'getAgentWorkflow').mockRejectedValue(new Error('network error'));

    renderPage();

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('does not show Approve/Reject for a Confirmed booking', async () => {
    vi.spyOn(agentWorkflowsApi, 'getAgentWorkflow').mockResolvedValue(sampleWorkflow());

    renderPage();

    await screen.findByText('This booking looks good.');
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
  });

  it('shows Approve/Reject for a PendingApproval booking and approves it', async () => {
    vi.spyOn(bookingsApi, 'getBookingById').mockResolvedValue(
      sampleBooking({ status: 'PendingApproval' }),
    );
    vi.spyOn(agentWorkflowsApi, 'getAgentWorkflow').mockResolvedValue(
      sampleWorkflow({ status: 'AwaitingApproval' }),
    );
    const decideSpy = vi.spyOn(bookingsApi, 'decideBooking').mockResolvedValue(sampleBooking({ status: 'Confirmed' }));

    renderPage();
    await screen.findByRole('button', { name: /^approve$/i });

    await userEvent.click(screen.getByRole('button', { name: /^approve$/i }));

    await waitFor(() => expect(decideSpy).toHaveBeenCalledWith('booking-1', { decision: 'Approve' }));
  });

  it('shows Reject but NOT Approve for a NeedsManualReview booking', async () => {
    vi.spyOn(bookingsApi, 'getBookingById').mockResolvedValue(
      sampleBooking({ status: 'NeedsManualReview' }),
    );
    vi.spyOn(agentWorkflowsApi, 'getAgentWorkflow').mockResolvedValue(
      sampleWorkflow({ status: 'Failed' }),
    );

    renderPage();
    await screen.findByRole('button', { name: /^reject$/i });

    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument();
  });
});
