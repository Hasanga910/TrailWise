import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import type { CurrentUser } from '../auth/types';
import { RegisterPage } from './RegisterPage';

function Probe({ label }: { label: string }) {
  const location = useLocation();
  return <div>{label} {location.pathname}{location.search}</div>;
}

function auth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    status: 'unauthenticated',
    error: null,
    fieldErrors: {},
    clearError: vi.fn(),
    login: vi.fn().mockResolvedValue(true),
    register: vi.fn().mockResolvedValue(true),
    logout: vi.fn(),
    updateUser: vi.fn(),
    ...overrides,
  };
}

function renderRegister(value: AuthContextValue, entry: string | { pathname: string; state: unknown } = '/register') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthContext.Provider value={value}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<Probe label="Login" />} />
          <Route path="/traveler/*" element={<Probe label="Traveler" />} />
          <Route path="/" element={<Probe label="Home" />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function fillValid(user: ReturnType<typeof userEvent.setup>, password = 'Str0ng!Passw0rd') {
  await user.type(screen.getByLabelText('Full name'), 'Amaya Silva');
  await user.type(screen.getByLabelText('Email'), 'amaya@example.com');
  await user.type(screen.getByLabelText('Contact number'), '+94 77 123 4567');
  await user.type(screen.getByLabelText('Password'), password);
}

describe('RegisterPage', () => {
  beforeEach(() => sessionStorage.clear());

  it('registers with the entered details', async () => {
    const user = userEvent.setup();
    const value = auth();
    renderRegister(value);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(value.register).toHaveBeenCalledWith('Amaya Silva', 'amaya@example.com', 'Str0ng!Passw0rd', '+94 77 123 4567');
  });

  it('shows inline errors on blur and does not submit invalid data', async () => {
    const user = userEvent.setup();
    const value = auth();
    renderRegister(value);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.tab();
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInvalid();

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter your full name')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument();
    expect(value.register).not.toHaveBeenCalled();
  });

  it('shows a live password strength meter', async () => {
    const user = userEvent.setup();
    renderRegister(auth());
    const input = screen.getByLabelText('Password');

    await user.type(input, 'abc');
    expect(screen.getByText('Weak')).toBeInTheDocument();
    expect(screen.getByText(/add 5 more characters/i)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'Abcdefg1!xyz');
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderRegister(auth());
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows the API error and maps server field errors next to their inputs', () => {
    renderRegister(auth({ error: 'Please fix the highlighted fields.', fieldErrors: { Email: 'That email is already registered.' } }));

    expect(screen.getByText('Please fix the highlighted fields.')).toBeInTheDocument();
    expect(screen.getByText('That email is already registered.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInvalid();
  });

  it('clears any leftover error when the page opens', () => {
    const value = auth();
    renderRegister(value);
    expect(value.clearError).toHaveBeenCalled();
  });

  it('sends a newly registered traveler back to the booking they were making', () => {
    const traveler: CurrentUser = { id: '1', name: 'A', email: 'a@e.com', contactNumber: '1', role: 'Traveler' };
    renderRegister(auth({ user: traveler, status: 'authenticated' }), {
      pathname: '/register',
      state: { from: '/traveler/bookings/new?tier=abc&guests=3' },
    });

    expect(screen.getByText('Traveler /traveler/bookings/new?tier=abc&guests=3')).toBeInTheDocument();
  });

  it('falls back to the sessionStorage copy when router state was lost, then clears it', () => {
    sessionStorage.setItem('trailwise_return_to', '/traveler/bookings/new?tier=zzz');
    const traveler: CurrentUser = { id: '1', name: 'A', email: 'a@e.com', contactNumber: '1', role: 'Traveler' };
    renderRegister(auth({ user: traveler, status: 'authenticated' }));

    expect(screen.getByText('Traveler /traveler/bookings/new?tier=zzz')).toBeInTheDocument();
    expect(sessionStorage.getItem('trailwise_return_to')).toBeNull();
  });

  it('ignores an unsafe return path', () => {
    const traveler: CurrentUser = { id: '1', name: 'A', email: 'a@e.com', contactNumber: '1', role: 'Traveler' };
    renderRegister(auth({ user: traveler, status: 'authenticated' }), { pathname: '/register', state: { from: '//evil.example' } });

    expect(screen.getByText('Traveler /traveler')).toBeInTheDocument();
  });

  it('mentions the booking when the visitor arrived from one, and keeps it when switching to login', async () => {
    const user = userEvent.setup();
    renderRegister(auth(), { pathname: '/register', state: { from: '/traveler/bookings/new?tier=abc' } });

    expect(screen.getByText(/take you straight back to your booking/i)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Log in' }));
    expect(screen.getByText('Login /login')).toBeInTheDocument();
  });
});
