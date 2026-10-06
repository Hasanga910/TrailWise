import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../api/agentWorkflows';
import type {
  AgentWorkflowRunDetailDto,
  AgentWorkflowRunListItemDto,
  AgentWorkflowSummaryDto,
} from '../../api/agentWorkflows';
import { notify } from '../../components/ui/notify';
import { useWorkflowStore } from '../../stores/workflowStore';
import { OpsWorkflowsPage } from './OpsWorkflowsPage';

vi.mock('../../components/ui/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../api/agentWorkflows', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/agentWorkflows')>()),
  listWorkflowRuns: vi.fn(),
  getWorkflowRun: vi.fn(),
  getWorkflowSummary: vi.fn(),
  startWorkflow: vi.fn(),
}));

function listItem(id: string, status: string, overrides: Partial<AgentWorkflowRunListItemDto> = {}): AgentWorkflowRunListItemDto {
  return {
    id,
    bookingId: `booking-${id}`,
    bookingStatus: 'PendingApproval',
    tourPackageName: `Package ${id}`,
    travelerName: `Traveler ${id}`,
    objective: 'Match a guide',
    status,
    startedAt: '2026-10-05T10:00:00Z',
    completedAt: null,
    stepsDone: 4,
    stepsTotal: 6,
    stepCount: 5,
    totalDurationMs: 1234,
    ...overrides,
  };
}

function detail(id: string, status: string, overrides: Partial<AgentWorkflowRunDetailDto> = {}): AgentWorkflowRunDetailDto {
  return {
    id,
    bookingId: `booking-${id}`,
    bookingStatus: 'PendingApproval',
    tourPackageName: `Package ${id}`,
    travelerName: `Traveler ${id}`,
    objective: 'Match a guide, price the trip and validate it.',
    status,
    startedAt: '2026-10-05T10:00:00Z',
    completedAt: null,
    plan: {
      steps: [
        { step: 'match_guide', agent: 'GuideMatchingAgent', status: 'done' },
        { step: 'validate', agent: 'PricingValidationAgent', status: 'pending' },
      ],
    },
    stepsDone: 1,
    stepsTotal: 2,
    steps: [
      {
        id: 's1',
        agentName: 'GuideMatchingAgent',
        input: { bookingId: 'b1' },
        output: { guideId: 'g1', matchScore: 0.9 },
        toolCalls: [
          { tool: 'guide_availability_read', input: 'guide g1, 2026-11-01 to 2026-11-04', result: 'available for the full period', status: 'ok', durationMs: 3 },
        ],
        validationResult: null,
        durationMs: 12,
        createdAt: '2026-10-05T10:00:01Z',
      },
      {
        id: 's2',
        agentName: 'PricingValidationAgent',
        input: {},
        output: { decision: 'NeedsApproval' },
        toolCalls: null,
        validationResult: 'NeedsApproval',
        durationMs: 1500,
        createdAt: '2026-10-05T10:00:02Z',
      },
    ],
    summaryText: 'A large group within budget.',
    advisoryFlags: ['Large group'],
    isLatestForBooking: true,
    pendingApproval: { id: 'appr-1', type: 'LargeGroupOrCustomItinerary' },
    ...overrides,
  };
}

const SUMMARY: AgentWorkflowSummaryDto = {
  runId: 'r1',
  bookingId: 'booking-r1',
  status: 'AwaitingApproval',
  startedAt: '2026-10-05T10:00:00Z',
  completedAt: null,
  totalDurationMs: 1512,
  stepCount: 2,
  toolCallCount: 1,
  validationResult: 'NeedsApproval',
  decision: null,
  summaryText: null,
  advisoryFlags: [],
  steps: [],
};

const paged = (items: AgentWorkflowRunListItemDto[], total = items.length) => ({ items, totalCount: total, page: 1, pageSize: 20 });

function renderPage(initial = '/ops/workflows') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/ops/workflows" element={<OpsWorkflowsPage />} />
        <Route path="/ops/approvals" element={<p>Approvals page</p>} />
        <Route path="/ops/bookings/:id/workflow" element={<p>Booking workflow page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OpsWorkflowsPage', () => {
  beforeEach(() => {
    useWorkflowStore.getState().reset();
    vi.mocked(api.listWorkflowRuns).mockReset();
    vi.mocked(api.getWorkflowRun).mockReset();
    vi.mocked(api.getWorkflowSummary).mockReset();
    vi.mocked(api.startWorkflow).mockReset();
    vi.mocked(notify.success).mockClear();
    vi.mocked(notify.error).mockClear();
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(
      paged([listItem('r1', 'AwaitingApproval'), listItem('r2', 'Completed', { completedAt: '2026-10-05T10:00:05Z' }), listItem('r3', 'Failed')]),
    );
    vi.mocked(api.getWorkflowRun).mockResolvedValue(detail('r1', 'AwaitingApproval'));
    vi.mocked(api.getWorkflowSummary).mockResolvedValue(SUMMARY);
  });

  it('lists the runs with status, progress, steps and time', async () => {
    renderPage();

    const row = (await screen.findByText('Package r1')).closest('tr')!;
    expect(within(row).getByText('Awaiting approval')).toBeInTheDocument();
    expect(within(row).getByText('Traveler r1 · PendingApproval')).toBeInTheDocument();
    expect(within(row).getByLabelText('4 of 6 plan steps done')).toBeInTheDocument();
    expect(within(row).getByText('5 · 1.2 s')).toBeInTheDocument();
    expect(within(screen.getByText('Package r2').closest('tr')!).getByText('Completed')).toBeInTheDocument();
    expect(within(screen.getByText('Package r3').closest('tr')!).getByText('Failed')).toBeInTheDocument();
  });

  it('shows a loading skeleton first', () => {
    vi.mocked(api.listWorkflowRuns).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByLabelText('Loading workflow runs')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    renderPage();
    await screen.findByText('Package r1');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Failed');

    await waitFor(() => expect(api.listWorkflowRuns).toHaveBeenLastCalledWith({ status: 'Failed', page: 1, pageSize: 20 }));
  });

  it('shows an empty state, naming the filter', async () => {
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(paged([]));
    renderPage();

    expect(await screen.findByText('No workflow runs')).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    vi.mocked(api.listWorkflowRuns).mockRejectedValueOnce(new Error('offline'));
    renderPage();

    expect(await screen.findByText('Could not load the workflow runs.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Package r1')).toBeInTheDocument();
  });

  it('pages through the runs when there are more than a page', async () => {
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(paged([listItem('r1', 'Completed')], 45));
    renderPage();

    expect(await screen.findByText('Page 1 of 3 (45 runs)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(vi.mocked(api.listWorkflowRuns).mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 }));
  });

  describe('drill-down', () => {
    async function openFirstRun() {
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'View run for Package r1' }));
      return screen.findByRole('dialog');
    }

    it('shows the plan with done and pending steps', async () => {
      const dialog = await openFirstRun();

      const plan = await within(dialog).findByRole('region', { name: 'Plan' });
      expect(plan).toHaveTextContent('Plan (1 of 2 steps done)');
      const items = within(plan).getAllByRole('listitem');
      expect(items[0]).toHaveTextContent('match_guide');
      expect(items[0]).toHaveTextContent('done');
      expect(items[1]).toHaveTextContent('pending');
    });

    it('shows every step with agent, timing, validation, tool calls, input and output', async () => {
      const dialog = await openFirstRun();

      const steps = await within(dialog).findByRole('region', { name: 'Steps' });
      const [guide, pricing] = within(steps).getAllByRole('listitem').filter((li) => li.tagName === 'LI' && li.querySelector('h4'));
      expect(within(guide).getByText(/GuideMatchingAgent/)).toBeInTheDocument();
      expect(within(guide).getByText('12 ms')).toBeInTheDocument();
      expect(within(guide).getByText('guide_availability_read')).toBeInTheDocument();
      expect(within(guide).getByText('guide g1, 2026-11-01 to 2026-11-04')).toBeInTheDocument();
      expect(within(guide).getByText('available for the full period')).toBeInTheDocument();
      expect(within(guide).getByText('3 ms')).toBeInTheDocument();
      expect(within(guide).getAllByText('Input').length).toBeGreaterThan(0);
      expect(guide).toHaveTextContent('"matchScore": 0.9');

      expect(within(pricing).getByText('NeedsApproval')).toBeInTheDocument();
      expect(within(pricing).getByText('1.5 s')).toBeInTheDocument();
      expect(within(pricing).getByText('No tool calls recorded for this step.')).toBeInTheDocument();
    });

    it('shows the execution summary, the agent summary and advisory flags', async () => {
      const dialog = await openFirstRun();

      const summary = await within(dialog).findByRole('region', { name: 'Execution summary' });
      await within(summary).findByText('1.5 s');
      expect(summary).toHaveTextContent('Steps2');
      expect(summary).toHaveTextContent('Tool calls1');
      expect(summary).toHaveTextContent('Validation');
      expect(within(summary).getAllByText('NeedsApproval').length).toBeGreaterThan(0);
      expect(within(summary).getByText('A large group within budget.')).toBeInTheDocument();
      expect(within(summary).getByText('Large group')).toBeInTheDocument();
    });

    it('shows the manager decision once there is one', async () => {
      vi.mocked(api.getWorkflowSummary).mockResolvedValue({
        ...SUMMARY,
        decision: { decision: 'Approve', notes: 'Fine by me', newStatus: 'Confirmed', decidedAt: '2026-10-05T11:00:00Z' },
      });
      const dialog = await openFirstRun();

      const summary = await within(dialog).findByRole('region', { name: 'Execution summary' });
      expect(await within(summary).findByText(/Fine by me/)).toBeInTheDocument();
      expect(summary).toHaveTextContent('Decision: Approve (booking now Confirmed)');
    });

    it('says when the execution summary cannot be loaded', async () => {
      vi.mocked(api.getWorkflowSummary).mockRejectedValue(new Error('x'));
      const dialog = await openFirstRun();

      expect(await within(dialog).findByText('The execution summary could not be loaded.')).toBeInTheDocument();
    });

    it('links to the pending approval and to the booking workflow page', async () => {
      const dialog = await openFirstRun();

      const approval = await within(dialog).findByRole('link', { name: 'Review in approval queue' });
      expect(approval).toHaveAttribute('href', '/ops/approvals?type=LargeGroupOrCustomItinerary&approval=appr-1');
      expect(within(dialog).getByRole('link', { name: 'Open booking workflow page' })).toHaveAttribute('href', '/ops/bookings/booking-r1/workflow');
    });

    it('has no approval link when nothing is pending', async () => {
      vi.mocked(api.getWorkflowRun).mockResolvedValue(detail('r1', 'Completed', { pendingApproval: null }));
      const dialog = await openFirstRun();

      await within(dialog).findByRole('region', { name: 'Plan' });
      expect(within(dialog).queryByRole('link', { name: 'Review in approval queue' })).not.toBeInTheDocument();
    });

    it('notes that a newer run exists for the booking, and offers no re-run', async () => {
      vi.mocked(api.getWorkflowRun).mockResolvedValue(detail('r1', 'Failed', { bookingStatus: 'NeedsManualReview', isLatestForBooking: false }));
      const dialog = await openFirstRun();

      expect(await within(dialog).findByText(/A newer run exists for this booking/)).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: 'Re-run workflow' })).not.toBeInTheDocument();
    });

    it.each(['Requested', 'NeedsManualReview'])('offers a re-run for a latest run whose booking is %s', async (bookingStatus) => {
      vi.mocked(api.getWorkflowRun).mockResolvedValue(detail('r1', 'Failed', { bookingStatus, pendingApproval: null }));
      const dialog = await openFirstRun();

      expect(await within(dialog).findByRole('button', { name: 'Re-run workflow' })).toBeInTheDocument();
    });

    it.each(['PendingApproval', 'Confirmed', 'Cancelled'])('offers no re-run when the booking is %s', async (bookingStatus) => {
      vi.mocked(api.getWorkflowRun).mockResolvedValue(detail('r1', 'Completed', { bookingStatus }));
      const dialog = await openFirstRun();

      await within(dialog).findByRole('region', { name: 'Plan' });
      expect(within(dialog).queryByRole('button', { name: 'Re-run workflow' })).not.toBeInTheDocument();
    });

    it('re-runs after confirming, shows the new run and reports success', async () => {
      vi.mocked(api.getWorkflowRun)
        .mockResolvedValueOnce(detail('r1', 'Failed', { bookingStatus: 'NeedsManualReview', pendingApproval: null }))
        .mockResolvedValue(detail('r9', 'AwaitingApproval')); // the new run, refreshed while it is active
      vi.mocked(api.startWorkflow).mockResolvedValue(detail('r9', 'AwaitingApproval'));
      const dialog = await openFirstRun();
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Re-run workflow' }));

      const confirm = await screen.findByRole('dialog', { name: 'Re-run this workflow?' });
      await userEvent.click(within(confirm).getByRole('button', { name: 'Re-run workflow' }));

      await waitFor(() => expect(api.startWorkflow).toHaveBeenCalledWith('booking-r1'));
      await waitFor(() => expect(notify.success).toHaveBeenCalled());
      expect(await screen.findByText('Package r9')).toBeInTheDocument();
    });

    it('does nothing when the re-run confirmation is cancelled', async () => {
      vi.mocked(api.getWorkflowRun).mockResolvedValue(detail('r1', 'Failed', { bookingStatus: 'Requested', pendingApproval: null }));
      const dialog = await openFirstRun();
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Re-run workflow' }));

      await userEvent.click(within(await screen.findByRole('dialog', { name: 'Re-run this workflow?' })).getByRole('button', { name: 'Cancel' }));

      expect(api.startWorkflow).not.toHaveBeenCalled();
    });

    it('reports a failed re-run', async () => {
      vi.mocked(api.getWorkflowRun).mockResolvedValue(detail('r1', 'Failed', { bookingStatus: 'Requested', pendingApproval: null }));
      vi.mocked(api.startWorkflow).mockRejectedValue(new Error('conflict'));
      const dialog = await openFirstRun();
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Re-run workflow' }));
      const confirm = await screen.findByRole('dialog', { name: 'Re-run this workflow?' });

      await userEvent.click(within(confirm).getByRole('button', { name: 'Re-run workflow' }));

      await waitFor(() => expect(notify.error).toHaveBeenCalledWith('The workflow could not be started', 'The workflow could not be started.'));
    });

    it('shows an error when the run cannot be loaded', async () => {
      vi.mocked(api.getWorkflowRun).mockRejectedValue(new Error('gone'));
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'View run for Package r1' }));

      expect(await screen.findByText('Could not load this workflow run.')).toBeInTheDocument();
    });

    it('closes the drill-down', async () => {
      const dialog = await openFirstRun();
      await within(dialog).findByRole('region', { name: 'Plan' });

      await userEvent.click(within(dialog).getByRole('button', { name: 'Close panel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('opens a run straight from ?run=', async () => {
    renderPage('/ops/workflows?run=r1');

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('region', { name: 'Plan' })).toBeInTheDocument();
    expect(api.getWorkflowRun).toHaveBeenCalledWith('r1');
  });
});

describe('OpsWorkflowsPage live status', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useWorkflowStore.getState().reset();
    vi.mocked(api.listWorkflowRuns).mockReset();
    vi.mocked(api.getWorkflowRun).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes by itself while a run is active, and says so', async () => {
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(paged([listItem('r1', 'Running')]));
    renderPage();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByRole('status')).toHaveTextContent('Live: refreshing every 5 s');
    const before = vi.mocked(api.listWorkflowRuns).mock.calls.length;

    await act(() => vi.advanceTimersByTimeAsync(5000));
    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(vi.mocked(api.listWorkflowRuns).mock.calls.length).toBe(before + 2);
  });

  it('picks up a status change from the next refresh', async () => {
    vi.mocked(api.listWorkflowRuns).mockResolvedValueOnce(paged([listItem('r1', 'Running')]));
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(paged([listItem('r1', 'Completed')]));
    renderPage();
    await act(() => vi.advanceTimersByTimeAsync(0));
    const row = () => screen.getByText('Package r1').closest('tr')!;
    expect(within(row()).getByText('Running')).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(within(row()).getByText('Completed')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('All runs on this page are finished');
  });

  it('does not poll when every run is finished', async () => {
    vi.mocked(api.listWorkflowRuns).mockResolvedValue(paged([listItem('r1', 'Completed')]));
    renderPage();
    await act(() => vi.advanceTimersByTimeAsync(0));
    const before = vi.mocked(api.listWorkflowRuns).mock.calls.length;

    await act(() => vi.advanceTimersByTimeAsync(30000));

    expect(vi.mocked(api.listWorkflowRuns).mock.calls.length).toBe(before);
  });
});
