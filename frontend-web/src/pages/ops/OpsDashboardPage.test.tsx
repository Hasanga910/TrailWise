import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../api/reports';
import type { DashboardRefundExceptionDto, OpsDashboardDto } from '../../api/reports';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { startsInText } from '../../components/ops/dashboard/dashboardFormat';
import { OpsDashboardPage } from './OpsDashboardPage';

vi.mock('../../api/reports', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/reports')>()),
  getOpsDashboard: vi.fn(),
}));

function refund(id: string, daysUntilStart: number, overrides: Partial<DashboardRefundExceptionDto> = {}): DashboardRefundExceptionDto {
  return {
    approvalId: `appr-${id}`,
    bookingId: `booking-${id}`,
    tourPackageName: `Package ${id}`,
    travelerName: `Traveler ${id}`,
    startDate: '2026-10-07',
    daysUntilStart,
    urgent: daysUntilStart <= 2,
    requestedAt: '2026-10-05T09:00:00Z',
    ...overrides,
  };
}

function dashboard(overrides: Partial<OpsDashboardDto> = {}): OpsDashboardDto {
  return {
    generatedAt: '2026-10-05T10:00:00Z',
    upcomingTours: [
      {
        bookingId: 'b1',
        tourPackageName: 'Hill Country Trek',
        travelerName: 'Pat Traveler',
        startDate: '2026-10-07',
        endDate: '2026-10-10',
        groupSize: 4,
        daysUntilStart: 2,
        guideName: 'Nimali Guide',
        vehicleRegistration: 'WP-1234',
        driverName: 'Kamal Driver',
      },
      {
        bookingId: 'b2',
        tourPackageName: 'Coastal Escape',
        travelerName: 'Sam Traveler',
        startDate: '2026-10-20',
        endDate: '2026-10-23',
        groupSize: 1,
        daysUntilStart: 15,
        guideName: null,
        vehicleRegistration: null,
        driverName: null,
      },
    ],
    approvals: {
      counts: { largeGroupOrCustomItinerary: 2, budgetOverride: 1, refundException: 3, total: 6 },
      urgentWithinDays: 2,
      urgentCount: 2,
      refundExceptions: [refund('A', 1), refund('B', 2), refund('C', 5)],
    },
    guideUtilization: {
      window: { from: '2026-10-05', to: '2026-11-03', days: 30 },
      overallPercentage: 50,
      guides: [{ guideId: 'g1', guideName: 'Nimali Guide', assignedDays: 5, availableDays: 5, recordedDays: 10, utilizationPercentage: 50 }],
    },
    vehicleUtilization: {
      window: { from: '2026-10-05', to: '2026-11-03', days: 30 },
      overallPercentage: 33.33,
      inServiceVehicles: 1,
      vehicles: [
        { vehicleId: 'v1', registrationNumber: 'WP-1234', type: 'Van', maintenanceStatus: 'Available', bookedDays: 10, utilizationPercentage: 33.33 },
        { vehicleId: 'v2', registrationNumber: 'WP-9999', type: 'Coach', maintenanceStatus: 'OutOfService', bookedDays: 0, utilizationPercentage: 0 },
      ],
    },
    workflows: { running: 1, awaitingApproval: 2, failed: 3, bookingsNeedingManualReview: 4 },
    ...overrides,
  };
}

const auth: AuthContextValue = {
  user: { id: '1', name: 'Olivia Ops', email: 'o@example.com', contactNumber: '1', role: 'OperationsManager' },
  status: 'authenticated',
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
};

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ops']}>
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route path="/ops" element={<OpsDashboardPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('OpsDashboardPage', () => {
  beforeEach(() => {
    // The stat cards count up unless the user prefers reduced motion; tests want the final values.
    window.matchMedia = ((query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    vi.mocked(api.getOpsDashboard).mockReset();
    vi.mocked(api.getOpsDashboard).mockResolvedValue(dashboard());
  });

  it('greets the user and shows a loading skeleton first', () => {
    vi.mocked(api.getOpsDashboard).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole('heading', { name: 'Operations dashboard' })).toBeInTheDocument();
    expect(screen.getByText(/Welcome back, Olivia Ops/)).toBeInTheDocument();
    expect(screen.getByLabelText('Loading dashboard')).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    vi.mocked(api.getOpsDashboard).mockRejectedValueOnce(new Error('offline'));
    renderPage();

    expect(await screen.findByText('Could not load the dashboard.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('region', { name: 'Pending approvals' })).toBeInTheDocument();
  });

  describe('urgent cancellation requests', () => {
    it('highlights only the requests whose tour starts within the urgent window', async () => {
      renderPage();

      const section = await screen.findByRole('region', { name: 'Urgent cancellation requests' });
      expect(section).toHaveTextContent('Urgent: 2 cancellation requests need a decision');
      expect(section).toHaveTextContent('start within 2 days');
      expect(within(section).getByText('Package A')).toBeInTheDocument();
      expect(within(section).getByText('Package B')).toBeInTheDocument();
      expect(within(section).queryByText('Package C')).not.toBeInTheDocument();
      // Not colour alone: each carries the word "Urgent" and the timing.
      expect(within(section).getByText('Urgent: starts tomorrow')).toBeInTheDocument();
      expect(within(section).getByText('Urgent: starts in 2 days')).toBeInTheDocument();
    });

    it('links each urgent request to that item in the approval queue', async () => {
      renderPage();

      const link = await screen.findByRole('link', { name: 'Review cancellation for Package A' });
      expect(link).toHaveAttribute('href', '/ops/approvals?type=RefundException&approval=appr-A');
      await userEvent.click(link);
      expect(screen.getByTestId('where')).toHaveTextContent('/ops/approvals?type=RefundException&approval=appr-A');
    });

    it('uses the singular for one request', async () => {
      vi.mocked(api.getOpsDashboard).mockResolvedValue(
        dashboard({ approvals: { ...dashboard().approvals, refundExceptions: [refund('A', 0)], urgentCount: 1 } }),
      );
      renderPage();

      expect(await screen.findByRole('region', { name: 'Urgent cancellation requests' })).toHaveTextContent('Urgent: 1 cancellation request needs a decision');
    });

    it('flags a tour that has already started', async () => {
      vi.mocked(api.getOpsDashboard).mockResolvedValue(
        dashboard({ approvals: { ...dashboard().approvals, refundExceptions: [refund('A', -1)], urgentCount: 1 } }),
      );
      renderPage();

      expect(await screen.findByText('Urgent: started yesterday')).toBeInTheDocument();
    });

    it('is not shown when no request is urgent', async () => {
      vi.mocked(api.getOpsDashboard).mockResolvedValue(
        dashboard({ approvals: { ...dashboard().approvals, refundExceptions: [refund('C', 5)], urgentCount: 0 } }),
      );
      renderPage();

      await screen.findByRole('region', { name: 'Pending approvals' });
      expect(screen.queryByRole('region', { name: 'Urgent cancellation requests' })).not.toBeInTheDocument();
    });

    it('describes the timing in plain words', () => {
      expect(startsInText(-3)).toBe('started 3 days ago');
      expect(startsInText(-1)).toBe('started yesterday');
      expect(startsInText(0)).toBe('starts today');
      expect(startsInText(1)).toBe('starts tomorrow');
      expect(startsInText(9)).toBe('starts in 9 days');
    });
  });

  describe('pending approvals', () => {
    it('shows the total and a count per type, each linking into the queue', async () => {
      renderPage();

      const section = await screen.findByRole('region', { name: 'Pending approvals' });
      const all = within(section).getByRole('link', { name: 'All pending approvals: 6' });
      expect(all).toHaveAttribute('href', '/ops/approvals');
      expect(all).toHaveTextContent('2 urgent');
      expect(within(section).getByRole('link', { name: 'Large group / custom itinerary: 2' })).toHaveAttribute('href', '/ops/approvals?type=LargeGroupOrCustomItinerary');
      expect(within(section).getByRole('link', { name: 'Budget override: 1' })).toHaveAttribute('href', '/ops/approvals?type=BudgetOverride');
      expect(within(section).getByRole('link', { name: 'Cancellation / refund exception: 3' })).toHaveAttribute('href', '/ops/approvals?type=RefundException');
    });

    it('says none are urgent when none are', async () => {
      vi.mocked(api.getOpsDashboard).mockResolvedValue(dashboard({ approvals: { ...dashboard().approvals, urgentCount: 0, refundExceptions: [] } }));
      renderPage();

      expect(await screen.findByRole('link', { name: 'All pending approvals: 6' })).toHaveTextContent('none urgent');
    });
  });

  it('shows workflow health and links to the monitor', async () => {
    renderPage();

    const section = await screen.findByRole('region', { name: 'Workflow health' });
    expect(section).toHaveTextContent('Running1');
    expect(section).toHaveTextContent('Awaiting approval2');
    expect(section).toHaveTextContent('Failed runs3');
    expect(section).toHaveTextContent('Needs manual review4');
    expect(within(section).getByRole('link', { name: 'Open the monitor' })).toHaveAttribute('href', '/ops/workflows');
  });

  describe('upcoming tours', () => {
    it('lists the tours with guide, vehicle and driver, or "not assigned"', async () => {
      renderPage();

      const tours = await screen.findByRole('region', { name: 'Upcoming tours' });
      const first = within(tours).getByText('Hill Country Trek').closest('li')!;
      expect(first).toHaveTextContent('Pat Traveler · 4 travelers');
      expect(first).toHaveTextContent('Guide: Nimali Guide · Vehicle: WP-1234 (Kamal Driver)');
      expect(first).toHaveTextContent('starts in 2 days');
      const second = within(tours).getByText('Coastal Escape').closest('li')!;
      expect(second).toHaveTextContent('1 traveler');
      expect(second).toHaveTextContent('Guide: not assigned · Vehicle: not assigned');
    });

    it('has an empty state', async () => {
      vi.mocked(api.getOpsDashboard).mockResolvedValue(dashboard({ upcomingTours: [] }));
      renderPage();

      expect(await screen.findByText('No upcoming tours')).toBeInTheDocument();
    });
  });

  describe('utilisation', () => {
    it('shows the overall guide figure and a labelled bar per guide', async () => {
      renderPage();

      const guides = await screen.findByRole('region', { name: 'Guide utilisation' });
      expect(guides).toHaveTextContent('50% of recorded guide days assigned');
      const meter = within(guides).getByRole('meter', { name: 'Nimali Guide utilisation' });
      expect(meter).toHaveAttribute('aria-valuenow', '50');
      expect(guides).toHaveTextContent('5 of 10 days · 50%');
    });

    it('shows the overall vehicle figure, flags out-of-service vehicles, and a bar per vehicle', async () => {
      renderPage();

      const vehicles = await screen.findByRole('region', { name: 'Vehicle utilisation' });
      expect(vehicles).toHaveTextContent('33% of 1 vehicle in service booked');
      expect(within(vehicles).getByRole('meter', { name: 'WP-1234 (Van) utilisation' })).toHaveAttribute('aria-valuenow', '33');
      expect(within(vehicles).getByRole('meter', { name: 'WP-9999 (Coach), OutOfService utilisation' })).toHaveAttribute('aria-valuenow', '0');
      expect(vehicles).toHaveTextContent('10 of 30 days · 33%');
    });

    it('shows the date window', async () => {
      renderPage();

      expect(await screen.findAllByText('Oct 5, 2026 to Nov 3, 2026')).toHaveLength(2);
    });

    it('handles no guides or vehicles', async () => {
      const base = dashboard();
      vi.mocked(api.getOpsDashboard).mockResolvedValue(
        dashboard({
          guideUtilization: { ...base.guideUtilization, guides: [], overallPercentage: 0 },
          vehicleUtilization: { ...base.vehicleUtilization, vehicles: [], overallPercentage: 0, inServiceVehicles: 0 },
        }),
      );
      renderPage();

      expect(await screen.findByText('No guides yet.')).toBeInTheDocument();
      expect(screen.getByText('No vehicles yet.')).toBeInTheDocument();
    });
  });

  it('refreshes on demand', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Pending approvals' });
    vi.mocked(api.getOpsDashboard).mockResolvedValue(
      dashboard({ approvals: { ...dashboard().approvals, counts: { largeGroupOrCustomItinerary: 0, budgetOverride: 0, refundException: 0, total: 0 }, refundExceptions: [], urgentCount: 0 } }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByRole('link', { name: 'All pending approvals: 0' })).toBeInTheDocument();
    expect(api.getOpsDashboard).toHaveBeenCalledTimes(2);
  });
});
