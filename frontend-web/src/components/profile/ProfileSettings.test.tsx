import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as profileApi from '../../api/profile';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import type { UserRole } from '../../auth/types';
import { AdminProfileSettingsPage } from '../../pages/admin/AdminProfileSettingsPage';
import { DriverProfileSettingsPage } from '../../pages/driver/DriverProfileSettingsPage';
import { OpsProfileSettingsPage } from '../../pages/ops/OpsProfileSettingsPage';

function renderPage(page: React.ReactNode, role: UserRole) {
  const value: AuthContextValue = {
    user: { id: 'u1', name: 'Pat Example', email: 'pat@example.com', contactNumber: '0771112222', role },
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  };
  render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>{page}</AuthContext.Provider>
    </MemoryRouter>,
  );
  return value;
}

describe('role profile pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the Operations Manager profile with details and password sections', () => {
    renderPage(<OpsProfileSettingsPage />, 'OperationsManager');

    expect(screen.getByRole('heading', { name: 'Pat Example' })).toBeInTheDocument();
    expect(screen.getByText('Operations Manager')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profile details' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Change password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('pat@example.com');
    expect(screen.queryByRole('heading', { name: /danger zone/i })).not.toBeInTheDocument();
  });

  it('shows the Admin profile with the Administrator role and no self-delete', () => {
    renderPage(<AdminProfileSettingsPage />, 'Admin');

    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('saves the profile through the API', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(profileApi, 'updateProfile').mockResolvedValue({
      id: 'u1', name: 'Pat Example', email: 'pat@example.com', contactNumber: '0771112222', role: 'OperationsManager',
    });
    const auth = renderPage(<OpsProfileSettingsPage />, 'OperationsManager');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(spy).toHaveBeenCalledWith({ name: 'Pat Example', email: 'pat@example.com', contactNumber: '0771112222' });
    expect(auth.updateUser).toHaveBeenCalled();
  });

  it('rejects a mismatched confirmation without calling the API', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(profileApi, 'changePassword');
    renderPage(<OpsProfileSettingsPage />, 'OperationsManager');

    await user.type(screen.getByLabelText('Current password'), 'old-password');
    await user.type(screen.getByLabelText('New password'), 'new-password-1');
    await user.type(screen.getByLabelText('Confirm new password'), 'different-1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('New password and confirmation do not match.');
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows the Driver profile with its own wording and a delete confirmation', async () => {
    const user = userEvent.setup();
    renderPage(<DriverProfileSettingsPage />, 'Driver');

    expect(screen.getByRole('heading', { name: 'Personal Details' })).toBeInTheDocument();
    expect(screen.getByText(/professional driver/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Driver Account' }));
    expect(screen.getByRole('heading', { name: 'Delete Account Confirmation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes, Delete My Account' })).toBeInTheDocument();
  });
});
