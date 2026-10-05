import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { LoginPage } from './LoginPage';

function renderWithAuth(overrides: Partial<AuthContextValue> = {}, entry: string | { pathname: string; state: unknown } = '/login') {
  const value: AuthContextValue = {
    user: null,
    status: 'unauthenticated',
    error: null,
    login: vi.fn().mockResolvedValue(true),
    register: vi.fn().mockResolvedValue(true),
    logout: vi.fn(),
    updateUser: vi.fn(),
    ...overrides,
  };

  render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthContext.Provider value={value}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/traveler/*" element={<div>Traveler Area</div>} />
          <Route path="/ops" element={<div>Ops Area</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  return value;
}

describe('LoginPage', () => {
  it('renders email and password fields with a submit button', () => {
    renderWithAuth();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('calls login with the entered credentials on submit', async () => {
    const user = userEvent.setup();
    const auth = renderWithAuth();

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'P@ssword123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(auth.login).toHaveBeenCalledWith('alice@example.com', 'P@ssword123');
  });

  it('shows the error message from the auth context', () => {
    renderWithAuth({ error: 'Invalid email or password.' });

    expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
  });

  it('shows a show/hide toggle for the password', async () => {
    const user = userEvent.setup();
    renderWithAuth();

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('validates inline without calling the API', async () => {
    const user = userEvent.setup();
    const auth = renderWithAuth();

    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('clears a leftover error when the page opens', () => {
    const clearError = vi.fn();
    renderWithAuth({ clearError });
    expect(clearError).toHaveBeenCalled();
  });

  it('returns a signed-in traveler to the page they were heading to', () => {
    renderWithAuth(
      { status: 'authenticated', user: { id: '1', name: 'A', email: 'a@e.com', contactNumber: '1', role: 'Traveler' } },
      { pathname: '/login', state: { from: '/traveler/bookings/new?tier=1' } },
    );
    expect(screen.getByText('Traveler Area')).toBeInTheDocument();
  });

  it('does not send staff into a portal they cannot use', () => {
    renderWithAuth(
      { status: 'authenticated', user: { id: '2', name: 'O', email: 'o@e.com', contactNumber: '1', role: 'OperationsManager' } },
      { pathname: '/login', state: { from: '/traveler/bookings/new?tier=1' } },
    );
    expect(screen.getByText('Ops Area')).toBeInTheDocument();
  });

  it('adapts its heading when continuing a booking', () => {
    renderWithAuth({}, { pathname: '/login', state: { from: '/traveler/bookings/new?tier=1' } });
    expect(screen.getByRole('heading', { level: 1, name: 'Log in to continue' })).toBeInTheDocument();
  });
});
