import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthContextValue } from './AuthContext';
import { RequireRole } from './RequireRole';
import type { UserRole } from './types';

function renderGuarded(role: UserRole) {
  const value: AuthContextValue = {
    user: { id: '1', name: 'Alice', email: 'a@example.com', role },
    status: 'authenticated',
    error: null,
    login: async () => true,
    register: async () => true,
    logout: () => {},
  };

  render(
    <MemoryRouter initialEntries={['/manage/packages']}>
      <AuthContext.Provider value={value}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          <Route
            path="/manage/packages"
            element={
              <RequireRole allowedRoles={['OperationsManager', 'Admin']}>
                <div>Manage Packages Page</div>
              </RequireRole>
            }
          />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  it('renders children when the user has an allowed role', () => {
    renderGuarded('OperationsManager');
    expect(screen.getByText('Manage Packages Page')).toBeInTheDocument();
  });

  it('renders children for Admin, the other allowed role', () => {
    renderGuarded('Admin');
    expect(screen.getByText('Manage Packages Page')).toBeInTheDocument();
  });

  it('redirects to /dashboard when the user does not have an allowed role', () => {
    renderGuarded('Traveler');
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});
