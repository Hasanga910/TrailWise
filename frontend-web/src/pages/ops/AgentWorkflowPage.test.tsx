import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAgentWorkflow, type AgentWorkflowDto } from '../../api/agentWorkflows';
import { AgentWorkflowPage } from './AgentWorkflowPage';

vi.mock('../../api/agentWorkflows', () => ({
  getAgentWorkflow: vi.fn(),
}));

const mockedGetAgentWorkflow = vi.mocked(getAgentWorkflow);

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
    mockedGetAgentWorkflow.mockReset();
  });

  it('renders the summary card and steps in order', async () => {
    mockedGetAgentWorkflow.mockResolvedValue(sampleWorkflow());

    renderPage();

    expect(await screen.findByText('This booking looks good.')).toBeInTheDocument();
    expect(screen.getByText('Nothing unusual.')).toBeInTheDocument();

    const steps = screen.getAllByText(/Agent$/);
    expect(steps.map((el) => el.textContent)).toEqual(['PreferenceExtractionAgent', 'ProposalSummaryAgent']);
  });

  it('shows a placeholder when summaryText is null', async () => {
    mockedGetAgentWorkflow.mockResolvedValue(sampleWorkflow({ summaryText: null, advisoryFlags: [] }));

    renderPage();

    expect(await screen.findByText(/summary not available yet/i)).toBeInTheDocument();
  });

  it('shows a "no agent activity" message on a 404', async () => {
    const notFoundError = { isAxiosError: true, response: { status: 404, data: {} } };
    mockedGetAgentWorkflow.mockRejectedValue(notFoundError);

    renderPage();

    expect(await screen.findByText(/no agent activity recorded for this booking yet/i)).toBeInTheDocument();
  });

  it('shows an error banner with a retry button on other failures', async () => {
    mockedGetAgentWorkflow.mockRejectedValue(new Error('network error'));

    renderPage();

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
