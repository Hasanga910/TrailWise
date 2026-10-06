import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { getMyDriverAssignments } from './api/vehicles';
import { AuthContext, type AuthContextValue } from './auth/AuthContext';
import type { UserRole } from './auth/types';
import { ThemeProvider } from './theme/ThemeProvider';

vi.mock('./api/vehicles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/vehicles')>()),
  getMyDriverAssignments: vi.fn(),
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

describe('driver routes', () => {
  beforeEach(() => {
    vi.mocked(getMyDriverAssignments).mockReset();
    vi.mocked(getMyDriverAssignments).mockResolvedValue([]);
  });

  it.each([
    ['FleetCoordinator', '/driver/dashboard'],
    ['FleetCoordinator', '/driver/profile'],
    ['Admin', '/driver/dashboard'],
    ['Admin', '/driver/profile'],
    ['OperationsManager', '/driver/dashboard'],
    ['Traveler', '/driver/profile'],
  ] as const)('sends %s at %s to the no-access page, without asking for driver trips', async (role, path) => {
    renderAt(path, role);

    expect(await screen.findByText(/don't have access to this page/i)).toBeInTheDocument();
    expect(getMyDriverAssignments).not.toHaveBeenCalled();
  });

  it('lets a Driver open the dashboard and loads their trips', async () => {
    renderAt('/driver/dashboard', 'Driver');

    expect(await screen.findByText(/welcome/i)).toBeInTheDocument();
    expect(screen.queryByText(/don't have access to this page/i)).not.toBeInTheDocument();
    expect(getMyDriverAssignments).toHaveBeenCalled();
  });
});
