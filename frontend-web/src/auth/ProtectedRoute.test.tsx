import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthContextValue } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

function renderProtected(status: AuthContextValue['status']) {
  const value: AuthContextValue = {
    user: status === 'authenticated' ? { id: '1', name: 'Alice', email: 'a@example.com', role: 'Traveler' } : null,
    status,
    error: null,
    login: async () => true,
    register: async () => true,
    logout: () => {},
    updateUser: () => {},
  };

  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthContext.Provider value={value}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows a loading state while auth status is unresolved', () => {
    renderProtected('loading');
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    renderProtected('unauthenticated');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    renderProtected('authenticated');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
