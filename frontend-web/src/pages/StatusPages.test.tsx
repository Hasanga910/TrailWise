import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { NoAccessPage } from './NoAccessPage';
import { NotFoundPage } from './NotFoundPage';

function auth(role: 'Traveler' | null): AuthContextValue {
  return {
    user: role ? { id: '1', name: 'T', email: 't@e.com', contactNumber: '1', role } : null,
    status: role ? 'authenticated' : 'unauthenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  };
}

const wrap = (ui: React.ReactNode, role: 'Traveler' | null) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth(role)}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  );

describe('status pages', () => {
  it('404 links signed-in users to their dashboard', () => {
    wrap(<NotFoundPage />, 'Traveler');
    expect(screen.getByRole('link', { name: 'Back to my dashboard' })).toHaveAttribute('href', '/traveler');
  });

  it('404 links visitors to home', () => {
    wrap(<NotFoundPage />, null);
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });

  it('403 offers dashboard and account switch', () => {
    wrap(<NoAccessPage />, 'Traveler');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/don't have access/);
    expect(screen.getByRole('link', { name: 'Go to my dashboard' })).toHaveAttribute('href', '/traveler');
    expect(screen.getByRole('button', { name: 'Switch account' })).toBeInTheDocument();
  });
});
