import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthContextValue } from './AuthContext';
import { RequireRole } from './RequireRole';
import type { UserRole } from './types';

function renderApp(initialPath: string, role: UserRole) {
  const value: AuthContextValue = {
    user: { id: '1', name: 'Alice', email: 'a@example.com', contactNumber: '+14155550100', role },
    status: 'authenticated',
    error: null,
    login: async () => true,
    register: async () => true,
    logout: () => {},
    updateUser: () => {},
  };

  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={value}>
        <Routes>
          <Route
            path="/traveler"
            element={
              <RequireRole allowedRoles={['Traveler']}>
                <div>Traveler Home</div>
              </RequireRole>
            }
          />
          <Route
            path="/ops"
            element={
              <RequireRole allowedRoles={['OperationsManager']}>
                <div>Ops Home</div>
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole allowedRoles={['Admin']}>
                <div>Admin Home</div>
              </RequireRole>
            }
          />
          <Route path="/no-access" element={<div>No Access Page</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  it('renders children when the user has the allowed role', () => {
    renderApp('/admin', 'Admin');
    expect(screen.getByText('Admin Home')).toBeInTheDocument();
  });

  it('sends an OperationsManager to /no-access for the Admin console', () => {
    renderApp('/admin', 'OperationsManager');
    expect(screen.getByText('No Access Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Home')).not.toBeInTheDocument();
  });

  it('sends a Traveler to /no-access for the Ops console', () => {
    renderApp('/ops', 'Traveler');
    expect(screen.getByText('No Access Page')).toBeInTheDocument();
  });

  it('sends a TourGuide to /no-access for the Admin console', () => {
    renderApp('/admin', 'TourGuide');
    expect(screen.getByText('No Access Page')).toBeInTheDocument();
  });
});
