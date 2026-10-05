import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { changePassword, deleteSelfProfile, updateProfile } from '../../api/profile';
import { useAuth } from '../../auth/AuthContext';
import { Avatar } from '../../components/Avatar';
import { LockIcon, MailIcon } from '../../components/admin/icons';
import { notify } from '../../components/ui/notify';

const ROLE_LABEL = 'Fleet Coordinator';

export function FleetProfileSettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [contactNumber, setContactNumber] = useState(user?.contactNumber ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const inputClass =
    'w-full rounded-lg border border-border px-3 py-2 text-sm text-fg focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const labelClass = 'text-xs font-semibold text-fg-muted';

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ name, email, contactNumber });
      updateUser(updated);
      notify.success('Profile updated.');
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Could not update profile.'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setConfirmError('New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      notify.success('Password changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Could not change password.'));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-brand-soft to-surface-raised p-5">
        <Avatar name={user?.name ?? 'FC'} size="lg" />
        <div>
          <h2 className="font-heading text-lg font-bold text-fg">{user?.name}</h2>
          <p className="text-sm text-fg-muted">
            {user?.email} • {ROLE_LABEL}
          </p>
        </div>
      </div>

      <section className="mb-10 rounded-xl border border-border bg-surface-raised p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <MailIcon className="h-5 w-5 text-brand-text" />
          <h2 className="font-heading text-lg font-bold text-fg">Personal details</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input
              required
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              required
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Contact number</label>
            <input
              required
              type="tel"
              className={inputClass}
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <p className={`${inputClass} bg-surface-sunken text-fg-muted cursor-not-allowed`}>{ROLE_LABEL}</p>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
            >
              {savingProfile ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface-raised p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <LockIcon className="h-5 w-5 text-brand-text" />
          <h2 className="font-heading text-lg font-bold text-fg">Change password</h2>
        </div>
        <form onSubmit={handleChangePassword} className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Current password</label>
            <input
              required
              type="password"
              className={inputClass}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>New password</label>
            <input
              required
              type="password"
              minLength={8}
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Confirm new password</label>
            <input
              required
              type="password"
              minLength={8}
              className={inputClass}
              value={confirmPassword}
              aria-invalid={confirmError ? true : undefined}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setConfirmError(null);
              }}
            />
            {confirmError && (
              <p role="alert" className="mt-1 text-xs font-medium text-danger">
                {confirmError}
              </p>
            )}
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
            >
              {savingPassword ? 'Saving...' : 'Change password'}
            </button>
          </div>
        </form>
      </section>

      {/* Danger Zone: Account Self-Deletion */}
      <section className="mt-10 rounded-xl border border-danger/30 bg-danger-soft/40 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-danger-fg">Danger Zone</h2>
            <p className="mt-1 text-sm text-danger-fg">
              Permanently delete your Fleet Coordinator staff account and revoke all access.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-danger/30 bg-surface-raised px-4 py-2 text-sm font-semibold text-danger-fg shadow-sm transition hover:bg-danger-soft"
          >
            Delete Account
          </button>
        </div>
      </section>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-xl">
            <h3 className="font-heading text-lg font-bold text-fg">Delete Account</h3>
            <p className="mt-2 text-sm text-fg-muted">
              Are you sure you want to delete your account? This action is permanent and cannot be
              undone. You will be logged out immediately.
            </p>

            {deleteError && (
              <div role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-xs font-medium text-danger-fg">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-sunken"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={async () => {
                  setDeleteError(null);
                  setDeletingAccount(true);
                  try {
                    await deleteSelfProfile();
                    logout();
                    navigate('/login');
                  } catch (err) {
                    setDeleteError(extractErrorMessage(err, 'Failed to delete account.'));
                    setDeletingAccount(false);
                  }
                }}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {deletingAccount ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
