import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { changePassword, deleteSelfProfile, updateProfile } from '../../api/profile';
import { useAuth } from '../../auth/AuthContext';
import { Avatar } from '../../components/Avatar';
import { LockIcon, MailIcon } from '../../components/admin/icons';
import { notify } from '../../components/ui/notify';

export function DriverProfileSettingsPage() {
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
    'w-full rounded-lg border border-border px-3 py-2 text-sm text-fg focus:border-info focus:outline-none focus:ring-1 focus:ring-info';
  const labelClass = 'text-xs font-semibold text-fg-muted';

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ name, email, contactNumber });
      updateUser(updated);
      notify.success('Profile updated successfully.');
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
      notify.success('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Could not change password.'));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    setDeletingAccount(true);
    try {
      await deleteSelfProfile();
      logout();
      navigate('/login');
    } catch (err) {
      setDeleteError(extractErrorMessage(err, 'Could not delete account.'));
      setDeletingAccount(false);
    }
  }

  return (
    <>
    <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-info-soft to-surface-raised p-5 shadow-xs">
          <Avatar name={user?.name ?? 'Driver'} size="lg" />
          <div>
            <h2 className="font-heading text-lg font-bold text-fg">{user?.name}</h2>
            <p className="text-sm text-fg-muted">
              {user?.email} &bull; Professional Driver
            </p>
          </div>
        </div>

        {/* Profile Information */}
        <section className="mb-8 rounded-xl border border-border bg-surface-raised p-6 shadow-xs">
          <div className="flex items-center gap-2">
            <MailIcon className="h-5 w-5 text-info" />
            <h2 className="font-heading text-lg font-bold text-fg">Personal Details</h2>
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            Keep your driver name, email address, and emergency contact number up to date.
          </p>

          <form onSubmit={handleSaveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Full Name</label>
              <input
                required
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Email Address</label>
              <input
                required
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Contact / Mobile Number</label>
              <input
                required
                type="tel"
                className={inputClass}
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </section>

        {/* Change Password */}
        <section className="mb-8 rounded-xl border border-border bg-surface-raised p-6 shadow-xs">
          <div className="flex items-center gap-2">
            <LockIcon className="h-5 w-5 text-info" />
            <h2 className="font-heading text-lg font-bold text-fg">Change Password</h2>
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            Update your account password with at least 6 characters.
          </p>

          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <div>
              <label className={labelClass}>Current Password</label>
              <input
                required
                type="password"
                className={inputClass}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>New Password</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  className={inputClass}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Confirm New Password</label>
                <input
                  required
                  type="password"
                  minLength={6}
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
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </section>

        {/* Danger Zone: Delete Account */}
        <section className="rounded-xl border border-danger/30 bg-danger-soft/50 p-6">
          <h2 className="font-heading text-lg font-bold text-danger-fg">Danger Zone</h2>
          <p className="mt-1 text-xs text-danger-fg">
            Deleting your driver account will permanently remove your login credentials and unlink your vehicle roster profile.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700"
            >
              Delete Driver Account
            </button>
          </div>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-xl">
            <h3 className="font-heading text-lg font-bold text-fg">Delete Account Confirmation</h3>
            <p className="mt-2 text-sm text-fg-muted">
              Are you sure you want to delete your driver account? You will immediately be signed out and will lose access to the Driver Portal.
            </p>

            {deleteError && (
              <div role="alert" className="mt-3 rounded-lg bg-danger-soft p-3 text-xs text-danger-fg">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-sunken"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={handleDeleteAccount}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingAccount ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
