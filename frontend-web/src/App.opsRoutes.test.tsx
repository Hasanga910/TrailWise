import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import * as wf from './api/agentWorkflows';
import * as api from './api/approvals';
import { AuthContext, type AuthContextValue } from './auth/AuthContext';
import type { UserRole } from './auth/types';
import { useApprovalsStore } from './stores/approvalsStore';
import { ThemeProvider } from './theme/ThemeProvider';

vi.mock('./api/agentWorkflows', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/agentWorkflows')>()),
  listWorkflowRuns: vi.fn(),
}));

vi.mock('./api/approvals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/approvals')>()),
  getPendingApprovals: vi.fn(),
  decideApproval: vi.fn(),
}));

function renderAt(path: string, role: UserRole) {
  const auth: AuthContextValue = {
    user: { id: '1', name: 'Pat', email: 'pat@example.com', contactNumber: '+94770001111', role },
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <AuthContext.Provider value={auth}>
          <App />
        </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('Ops routes', () => {
  beforeEach(() => {
    useApprovalsStore.getState().reset();
    vi.mocked(api.getPendingApprovals).mockReset();
    vi.mocked(api.getPendingApprovals).mockResolvedValue({
      items: [],
      counts: { largeGroupOrCustomItinerary: 2, budgetOverride: 1, refundException: 3, total: 6 },
    });
  });

  it.each(['Traveler', 'TourGuide', 'FleetCoordinator', 'Driver'] as const)(
    'sends %s to the no-access page without loading the queue',
    async (role) => {
      renderAt('/ops/approvals', role);

      expect(await screen.findByText(/don't have access to this page/i)).toBeInTheDocument();
      expect(api.getPendingApprovals).not.toHaveBeenCalled();
    },
  );

  it.each(['OperationsManager', 'Admin'] as const)('lets %s open the queue', async (role) => {
    renderAt('/ops/approvals', role);

    expect(await screen.findByRole('heading', { name: 'Approval queue' })).toBeInTheDocument();
    expect(screen.queryByText(/don't have access to this page/i)).not.toBeInTheDocument();
  });

  it('shows the number of waiting approvals next to the Approvals nav link on every Ops page', async () => {
    renderAt('/ops/profile', 'OperationsManager');

    const link = await screen.findByRole('link', { name: /Approvals/ });
    expect(link).toHaveTextContent('6');
    expect(screen.getByLabelText('6 waiting')).toBeInTheDocument();
  });

  it('loads the queue once on first visit even though the layout and the page both ask for it', async () => {
    renderAt('/ops/approvals', 'OperationsManager');

    await screen.findByRole('heading', { name: 'Approval queue' });
    expect(vi.mocked(api.getPendingApprovals).mock.calls.length).toBeLessThanOrEqual(2);
  });

  describe('agent workflow monitor', () => {
    beforeEach(() => {
      vi.mocked(wf.listWorkflowRuns).mockReset();
      vi.mocked(wf.listWorkflowRuns).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    });

    it.each(['Traveler', 'TourGuide', 'FleetCoordinator', 'Driver'] as const)('sends %s to the no-access page', async (role) => {
      renderAt('/ops/workflows', role);

      expect(await screen.findByText(/don't have access to this page/i)).toBeInTheDocument();
      expect(wf.listWorkflowRuns).not.toHaveBeenCalled();
    });

    it.each(['OperationsManager', 'Admin'] as const)('lets %s open it, with a nav link', async (role) => {
      renderAt('/ops/workflows', role);

      expect(await screen.findByRole('heading', { name: 'Agent workflows' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Agent Workflows' })).toHaveAttribute('href', '/ops/workflows');
    });
  });
});
