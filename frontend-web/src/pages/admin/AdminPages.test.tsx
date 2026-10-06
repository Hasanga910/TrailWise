import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPackages, type TourPackage } from '../../api/packages';
import { getStaff, type StaffMember } from '../../api/staff';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { AdminOverviewPage } from './AdminOverviewPage';
import { PackagesOverviewPage } from './PackagesOverviewPage';
import { StaffRolePage } from './StaffRolePage';
import { UserManagementIndexPage } from './UserManagementIndexPage';

vi.mock('../../api/packages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/packages')>()),
  getPackages: vi.fn(),
}));
vi.mock('../../api/staff', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/staff')>()),
  getStaff: vi.fn(),
}));
vi.mock('../../api/locations', () => ({ searchLocations: vi.fn().mockResolvedValue([]) }));

const mockedGetPackages = vi.mocked(getPackages);
const mockedGetStaff = vi.mocked(getStaff);

const PACKAGE: TourPackage = {
  id: 'p1',
  name: 'Hill Country Escape',
  theme: 'Culture',
  durationDays: 3,
  basePricePerPerson: 100,
  maxGroupSize: 10,
  photoUrl: null,
  tiers: [{ id: 't1', classType: 'Normal', includesFood: true, basePricePerPerson: 100, requiresAC: false }],
  locations: [{ id: 'l1', name: 'Kandy' }],
} as TourPackage;

const STAFF: StaffMember[] = [
  { id: 'a1', name: 'System Admin', email: 'admin@example.com', contactNumber: '1', role: 'Admin' },
  { id: 'g1', name: 'Gina Guide', email: 'gina@example.com', contactNumber: '2', role: 'TourGuide' },
];

const AUTH: AuthContextValue = {
  user: { id: 'a1', name: 'System Admin', email: 'admin@example.com', contactNumber: '1', role: 'Admin' },
  status: 'authenticated',
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
};

function renderPage(page: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={AUTH}>{page}</AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('Admin pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPackages.mockResolvedValue([PACKAGE]);
    mockedGetStaff.mockResolvedValue(STAFF);
  });

  it('shows the overview with a welcome message and quick links', async () => {
    renderPage(<AdminOverviewPage />);

    expect(await screen.findByText(/welcome back, system/i)).toBeInTheDocument();
    expect(await screen.findByText('Total packages')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /user management/i })).toHaveAttribute('href', '/admin/staff');
  });

  it('shows the overview without errors on an empty system', async () => {
    mockedGetPackages.mockResolvedValue([]);
    mockedGetStaff.mockResolvedValue([]);
    renderPage(<AdminOverviewPage />);

    expect(await screen.findByText('Total packages')).toBeInTheDocument();
    expect(screen.getByText('No packages yet.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lists the staff role cards with account counts, and no Admin card or Drivers card', async () => {
    renderPage(<UserManagementIndexPage />);

    expect(await screen.findByRole('heading', { name: 'Tour Guides' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Operations Managers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fleet Coordinators' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Drivers' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^admins?$/i })).not.toBeInTheDocument();
  });

  it('shows a role page with its own staff and a create form fixed to that role', async () => {
    renderPage(<StaffRolePage role="TourGuide" roleLabel="Tour Guide" />);

    expect(await screen.findByRole('heading', { name: /tour guide accounts/i })).toBeInTheDocument();
    expect(await screen.findByText('Gina Guide')).toBeInTheDocument();
    expect(screen.queryByText('System Admin')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows the empty state for a role with no accounts', async () => {
    mockedGetStaff.mockResolvedValue([]);
    renderPage(<StaffRolePage role="Driver" roleLabel="Driver" />);

    expect(await screen.findByText(/no driver accounts yet/i)).toBeInTheDocument();
  });

  it('shows packages with their tiers and the create form', async () => {
    renderPage(<PackagesOverviewPage />);

    expect(screen.getByRole('heading', { name: 'Package management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create a new package' })).toBeInTheDocument();
    const card = (await screen.findByRole('heading', { name: 'Hill Country Escape' })).closest('div.rounded-card') as HTMLElement;
    expect(within(card).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(await screen.findByText('1 package configured')).toBeInTheDocument();
  });

  it('shows the empty state when there are no packages', async () => {
    mockedGetPackages.mockResolvedValue([]);
    renderPage(<PackagesOverviewPage />);

    expect(await screen.findByText('No tour packages yet.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
