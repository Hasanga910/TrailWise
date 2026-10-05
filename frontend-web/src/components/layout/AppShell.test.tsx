import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { DashboardIcon, ProfileIcon } from '../admin/icons';
import { AppShell } from './AppShell';

const auth: AuthContextValue = {
  user: { id: '1', name: 'Kasun Perera', email: 'k@example.com', contactNumber: '1', role: 'TourGuide' },
  status: 'authenticated',
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
};

function renderShell(path = '/x/profile', badge?: number | null) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <AuthContext.Provider value={auth}>
          <Routes>
            <Route
              path="/x"
              element={
                <AppShell
                  portalLabel="Test Portal"
                  pageTitles={{ '/x': 'Home', '/x/profile': 'Profile Settings' }}
                  navItems={[
                    { to: '/x', label: 'Home', icon: DashboardIcon, end: true },
                    { to: '/x/profile', label: 'Profile', icon: ProfileIcon, section: 'Account', badge },
                  ]}
                />
              }
            >
              <Route index element={<p>home page</p>} />
              <Route path="profile" element={<p>profile page</p>} />
            </Route>
          </Routes>
        </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.removeItem('trailwise_theme');
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders title, breadcrumbs, primary nav and outlet', async () => {
    renderShell();
    expect(screen.getByRole('heading', { level: 1, name: 'Profile Settings' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('profile page')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('switches theme from the account menu', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('switches theme from the header toggle', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: /switch to dark mode/i }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
  });

  it('opens the mobile drawer', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
  });

  it('collapses the sidebar and remembers it', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(localStorage.getItem('trailwise_sidebar_collapsed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('shows a count next to a nav item and announces it', () => {
    localStorage.clear();
    renderShell('/x/profile', 4);
    const link = screen.getByRole('link', { name: /Profile/ });
    expect(link).toHaveTextContent('4');
    expect(screen.getByLabelText('4 waiting')).toBeInTheDocument();
  });

  it.each([[null], [0], [undefined]])('shows no count when the badge is %s', (badge) => {
    localStorage.clear();
    renderShell('/x/profile', badge);
    expect(screen.queryByLabelText(/waiting/)).not.toBeInTheDocument();
  });

  it('marks a collapsed nav item with a dot and names the count for screen readers', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    renderShell('/x/profile', 2);
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('link', { name: 'Profile, 2 waiting' })).toBeInTheDocument();
  });
});
