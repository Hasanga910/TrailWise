import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { LoginPage } from './LoginPage';

function renderWithAuth(overrides: Partial<AuthContextValue> = {}) {
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
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  return value;
}

describe('LoginPage', () => {
  it('renders email and password fields with a submit button', () => {
    renderWithAuth();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('calls login with the entered credentials on submit', async () => {
    const user = userEvent.setup();
    const auth = renderWithAuth();

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'P@ssword123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(auth.login).toHaveBeenCalledWith('alice@example.com', 'P@ssword123');
  });

  it('shows the error message from the auth context', () => {
    renderWithAuth({ error: 'Invalid email or password.' });

    expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
  });
});
