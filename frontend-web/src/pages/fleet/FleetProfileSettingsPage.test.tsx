import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as profileApi from '../../api/profile';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { FleetProfileSettingsPage } from './FleetProfileSettingsPage';

function renderWithAuth(overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    user: {
      id: 'fcfcfcfc-fcfc-fcfc-fcfc-fcfcfcfcfcfc',
      name: 'Fleet Guy',
      email: 'fleet@trailwise.local',
      contactNumber: '0771122334',
      role: 'FleetCoordinator',
    },
    status: 'authenticated',
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
        <FleetProfileSettingsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  return value;
}

describe('FleetProfileSettingsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders profile details and Danger Zone section', () => {
    renderWithAuth();

    expect(screen.getByRole('heading', { name: /personal details/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /change password/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /danger zone/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete account$/i })).toBeInTheDocument();
  });

  it('opens confirmation modal and executes deleteSelfProfile and logout on confirm', async () => {
    const deleteSpy = vi.spyOn(profileApi, 'deleteSelfProfile').mockResolvedValue();
    const user = userEvent.setup();
    const auth = renderWithAuth();

    const openDeleteBtn = screen.getByRole('button', { name: /^delete account$/i });
    await user.click(openDeleteBtn);

    expect(
      screen.getByText(/are you sure you want to delete your account\? this action is permanent/i),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /yes, delete my account/i });
    await user.click(confirmBtn);

    expect(deleteSpy).toHaveBeenCalled();
    expect(auth.logout).toHaveBeenCalled();
  });
});
