import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { TravelerProfileSettingsPage } from './TravelerProfileSettingsPage';
import { notify } from '../../components/ui/notify';

vi.mock('../../components/ui/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../api/profile', () => ({
  updateProfile: vi.fn().mockResolvedValue({ id: '1', name: 'Jane', email: 'j@e.com', contactNumber: '1', role: 'Traveler' }),
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
}));

const auth: AuthContextValue = {
  user: { id: '1', name: 'Jane', email: 'j@e.com', contactNumber: '1', role: 'Traveler' },
  status: 'authenticated',
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
};

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>
        <TravelerProfileSettingsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('TravelerProfileSettingsPage', () => {
  it('toasts after saving the profile', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /save (profile|changes)/i }));
    expect(notify.success).toHaveBeenCalledWith('Profile updated.');
  });

  it('shows a password mismatch inline, not as a toast', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const pw = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="password"]'));
    await user.type(pw[0], 'current-pass');
    await user.type(pw[1], 'password-one');
    await user.type(pw[2], 'password-two');
    await user.click(screen.getByRole('button', { name: /(change|update) password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('New password and confirmation do not match.');
    expect(notify.error).not.toHaveBeenCalled();
  });
});
