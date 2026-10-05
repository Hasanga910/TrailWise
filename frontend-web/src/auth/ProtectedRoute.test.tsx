import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthContextValue } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

function LoginProbe() {
  const location = useLocation();
  return <div>Login Page from={(location.state as { from?: string } | null)?.from ?? 'none'}</div>;
}

function renderProtected(status: AuthContextValue['status'], initialPath = '/') {
  const value: AuthContextValue = {
    user:
      status === 'authenticated'
        ? { id: '1', name: 'Alice', email: 'a@example.com', contactNumber: '+14155550100', role: 'Traveler' }
        : null,
    status,
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
          <Route path="/login" element={<LoginProbe />} />
          <Route
            path="/*"
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
    expect(screen.getByText(/Login Page/)).toBeInTheDocument();
  });

  it('remembers the requested path (with its query) for the return trip', () => {
    renderProtected('unauthenticated', '/traveler/bookings/new?tier=abc&guests=3');
    expect(screen.getByText('Login Page from=/traveler/bookings/new?tier=abc&guests=3')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    renderProtected('authenticated');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
