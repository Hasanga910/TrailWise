import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignSupportTicket,
  getSupportTicket,
  getSupportTickets,
  sendSupportReply,
  updateSupportPriority,
  updateSupportStatus,
  type SupportTicketDetailDto,
  type SupportTicketListDto,
} from '../../api/support';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { RequireRole } from '../../auth/RequireRole';
import type { UserRole } from '../../auth/types';
import { OpsSupportPage } from './OpsSupportPage';
import { OpsTicketDetailPage } from './OpsTicketDetailPage';

vi.mock('../../api/support', () => ({
  getSupportTickets: vi.fn(),
  getSupportTicket: vi.fn(),
  sendSupportReply: vi.fn(),
  updateSupportStatus: vi.fn(),
  assignSupportTicket: vi.fn(),
  updateSupportPriority: vi.fn(),
}));

const mockedGetSupportTickets = vi.mocked(getSupportTickets);
const mockedGetSupportTicket = vi.mocked(getSupportTicket);
const mockedSendSupportReply = vi.mocked(sendSupportReply);
const mockedUpdateSupportStatus = vi.mocked(updateSupportStatus);
const mockedAssignSupportTicket = vi.mocked(assignSupportTicket);
const mockedUpdateSupportPriority = vi.mocked(updateSupportPriority);

function sampleTicketListItem(overrides: Partial<SupportTicketListDto> = {}): SupportTicketListDto {
  return {
    id: 'ticket-1',
    category: 'Trip',
    priority: 'Normal',
    status: 'Open',
    subject: 'Pickup inquiry',
    bookingId: 'book-1',
    packageName: 'Highland Tour',
    assignedToId: null,
    createdAt: '2026-09-29T10:00:00Z',
    updatedAt: '2026-09-29T10:30:00Z',
    ...overrides,
  };
}

function sampleTicketDetail(overrides: Partial<SupportTicketDetailDto> = {}): SupportTicketDetailDto {
  return {
    id: 'ticket-1',
    category: 'Trip',
    priority: 'Normal',
    status: 'Open',
    subject: 'Pickup inquiry',
    description: 'Could you confirm the pickup location at airport?',
    travelerId: 'trav-1',
    travelerDisplayName: 'Alice Traveler',
    bookingId: 'book-1',
    packageName: 'Highland Tour',
    assignedToId: null,
    assignedToName: null,
    createdAt: '2026-09-29T10:00:00Z',
    updatedAt: '2026-09-29T10:30:00Z',
    resolvedAt: null,
    closedAt: null,
    messages: [
      {
        id: 'msg-1',
        senderId: 'trav-1',
        senderDisplayName: 'Alice Traveler',
        isStaff: false,
        message: 'Could you confirm the pickup location at airport?',
        createdAt: '2026-09-29T10:00:00Z',
      },
    ],
    ...overrides,
  };
}

function renderWithAuth(
  ui: React.ReactElement,
  role: UserRole = 'OperationsManager',
  userId = 'staff-1',
) {
  const authValue: AuthContextValue = {
    user: {
      id: userId,
      name: 'Operations Staff',
      email: 'ops@trailwise.com',
      contactNumber: '+1234567890',
      role,
    },
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

function renderDetailPageWithAuth(
  ticketId = 'ticket-1',
  role: UserRole = 'OperationsManager',
  userId = 'staff-1',
) {
  const authValue: AuthContextValue = {
    user: {
      id: userId,
      name: 'Operations Staff',
      email: 'ops@trailwise.com',
      contactNumber: '+1234567890',
      role,
    },
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[`/ops/support/${ticketId}`]}>
        <Routes>
          <Route path="/ops/support/:ticketId" element={<OpsTicketDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function renderAppWithAuthRoute(initialPath: string, role: UserRole) {
  const authValue: AuthContextValue = {
    user: {
      id: 'staff-1',
      name: 'Test Staff',
      email: 'staff@trailwise.com',
      contactNumber: '+1234567890',
      role,
    },
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/ops/support"
            element={
              <RequireRole allowedRoles={['OperationsManager', 'Admin']}>
                <OpsSupportPage />
              </RequireRole>
            }
          />
          <Route
            path="/ops/support/:ticketId"
            element={
              <RequireRole allowedRoles={['OperationsManager', 'Admin']}>
                <OpsTicketDetailPage />
              </RequireRole>
            }
          />
          <Route path="/portal" element={<div>Access Denied / Fallback</div>} />
          <Route path="/fleet" element={<div>Fleet Coordinator Portal</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('OpsSupportPage & OpsTicketDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OpsSupportPage', () => {
    it('renders support table with ticket rows and view links', async () => {
      mockedGetSupportTickets.mockResolvedValue({
        items: [sampleTicketListItem()],
        totalCount: 1,
        page: 1,
        pageSize: 15,
      });

      renderWithAuth(<OpsSupportPage />);

      expect(await screen.findByText('Pickup inquiry')).toBeInTheDocument();
      expect(screen.getAllByText('Trip').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Normal').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);

      const viewLink = screen.getByRole('link', { name: 'View' });
      expect(viewLink).toHaveAttribute('href', '/ops/support/ticket-1');
    });

    it('filters tickets by status when status dropdown changes', async () => {
      mockedGetSupportTickets.mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 15,
      });

      renderWithAuth(<OpsSupportPage />);

      const statusSelect = await screen.findByLabelText(/status/i);
      await userEvent.selectOptions(statusSelect, 'Resolved');

      await waitFor(() => {
        expect(mockedGetSupportTickets).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'Resolved' }),
        );
      });
    });

    it('filters tickets by search query', async () => {
      mockedGetSupportTickets.mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 15,
      });

      renderWithAuth(<OpsSupportPage />);

      const searchInput = await screen.findByPlaceholderText(/search subject or traveler/i);
      await userEvent.type(searchInput, 'refund');

      await waitFor(() => {
        expect(mockedGetSupportTickets).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'refund' }),
        );
      });
    });
  });

  describe('OpsTicketDetailPage', () => {
    it('loads and renders ticket details, traveler info, and messages', async () => {
      mockedGetSupportTicket.mockResolvedValue(sampleTicketDetail());

      renderDetailPageWithAuth('ticket-1');

      expect(await screen.findByText('Pickup inquiry')).toBeInTheDocument();
      expect(
        screen.getAllByText('Could you confirm the pickup location at airport?').length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText('Alice Traveler').length).toBeGreaterThan(0);
      expect(screen.getByText(/Highland Tour/)).toBeInTheDocument();
      expect(screen.getByLabelText(/change status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/change priority/i)).toBeInTheDocument();
    });

    it('allows staff to send a reply message', async () => {
      mockedGetSupportTicket.mockResolvedValue(sampleTicketDetail());
      mockedSendSupportReply.mockResolvedValue({
        id: 'msg-new',
        senderId: 'staff-1',
        senderDisplayName: 'Operations Staff',
        isStaff: true,
        message: 'Yes, driver will meet you at terminal exit 2.',
        createdAt: '2026-09-29T11:00:00Z',
      });

      renderDetailPageWithAuth('ticket-1');

      const replyTextarea = await screen.findByPlaceholderText(
        /type your response to the traveler/i,
      );
      await userEvent.type(replyTextarea, 'Yes, driver will meet you at terminal exit 2.');

      const sendButton = screen.getByRole('button', { name: /send reply/i });
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockedSendSupportReply).toHaveBeenCalledWith(
          'ticket-1',
          'Yes, driver will meet you at terminal exit 2.',
        );
      });
    });

    it('updates ticket status', async () => {
      mockedGetSupportTicket.mockResolvedValue(sampleTicketDetail());
      mockedUpdateSupportStatus.mockResolvedValue(
        sampleTicketDetail({ status: 'InProgress' }),
      );

      renderDetailPageWithAuth('ticket-1');

      const statusSelect = await screen.findByLabelText(/change status/i);
      await userEvent.selectOptions(statusSelect, 'InProgress');

      await waitFor(() => {
        expect(mockedUpdateSupportStatus).toHaveBeenCalledWith('ticket-1', 'InProgress');
      });
    });

    it('updates ticket priority', async () => {
      mockedGetSupportTicket.mockResolvedValue(sampleTicketDetail());
      mockedUpdateSupportPriority.mockResolvedValue(
        sampleTicketDetail({ priority: 'Urgent' }),
      );

      renderDetailPageWithAuth('ticket-1');

      const prioritySelect = await screen.findByLabelText(/change priority/i);
      await userEvent.selectOptions(prioritySelect, 'Urgent');

      await waitFor(() => {
        expect(mockedUpdateSupportPriority).toHaveBeenCalledWith('ticket-1', 'Urgent');
      });
    });

    it('assigns ticket to current staff user', async () => {
      mockedGetSupportTicket.mockResolvedValue(sampleTicketDetail({ assignedToId: null }));
      mockedAssignSupportTicket.mockResolvedValue(
        sampleTicketDetail({ assignedToId: 'staff-1', assignedToName: 'Operations Staff' }),
      );

      renderDetailPageWithAuth('ticket-1', 'OperationsManager', 'staff-1');

      const assignButton = await screen.findByRole('button', { name: /assign to me/i });
      await userEvent.click(assignButton);

      await waitFor(() => {
        expect(mockedAssignSupportTicket).toHaveBeenCalledWith('ticket-1', 'staff-1');
      });
    });
  });

  describe('Role-based protection', () => {
    it('allows OperationsManager and Admin to access ops support page', async () => {
      mockedGetSupportTickets.mockResolvedValue({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 15,
      });

      renderAppWithAuthRoute('/ops/support', 'OperationsManager');

      expect(await screen.findByText('Support Tickets')).toBeInTheDocument();
    });

    it('redirects unauthorized roles (e.g. TourGuide) away from ops support page', async () => {
      renderAppWithAuthRoute('/ops/support', 'TourGuide');

      expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
      expect(screen.queryByText('Support Tickets')).not.toBeInTheDocument();
    });

    it('redirects FleetCoordinator away from ops support page', async () => {
      renderAppWithAuthRoute('/ops/support', 'FleetCoordinator');

      expect(await screen.findByText(/fleet coordinator portal/i)).toBeInTheDocument();
      expect(screen.queryByText('Support Tickets')).not.toBeInTheDocument();
    });
  });
});
