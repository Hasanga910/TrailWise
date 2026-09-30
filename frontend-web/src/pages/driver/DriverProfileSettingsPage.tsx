import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { changePassword, deleteSelfProfile, updateProfile } from '../../api/profile';
import { useAuth } from '../../auth/AuthContext';
import { Avatar } from '../../components/Avatar';
import { Logo } from '../../components/Logo';
import { LockIcon, MailIcon, LogoutIcon, TruckIcon } from '../../components/admin/icons';

export function DriverProfileSettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [contactNumber, setContactNumber] = useState(user?.contactNumber ?? '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
  const labelClass = 'text-xs font-semibold text-slate-600';

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ name, email, contactNumber });
      updateUser(updated);
      setProfileSuccess('Profile updated successfully.');
    } catch (err) {
      setProfileError(extractErrorMessage(err, 'Could not update profile.'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(extractErrorMessage(err, 'Could not change password.'));
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
    <div className="min-h-svh bg-slate-50">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-blue-600 before:via-sky-500 before:to-blue-600">
        <div className="flex items-center gap-4">
          <Link to="/driver/dashboard" title="Home" className="flex items-center gap-2">
            <Logo className="h-7 w-auto" />
          </Link>
          <span className="hidden text-slate-300 sm:inline">|</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <TruckIcon className="h-4 w-4" />
            </span>
            <Link to="/driver/dashboard" className="font-heading text-lg font-bold text-slate-900 hover:text-blue-600">
              Driver Portal
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/driver/dashboard"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            &larr; Tasks Dashboard
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-700">{user?.name}</p>
            <p className="text-xs text-slate-500">Professional Driver</p>
          </div>
          {user && <Avatar name={user.name} size="sm" />}

          <button
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogoutIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-xs">
          <Avatar name={user?.name ?? 'Driver'} size="lg" />
          <div>
            <h2 className="font-heading text-lg font-bold text-slate-900">{user?.name}</h2>
            <p className="text-sm text-slate-500">
              {user?.email} &bull; Professional Driver
            </p>
          </div>
        </div>

        {/* Profile Information */}
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2">
            <MailIcon className="h-5 w-5 text-blue-600" />
            <h2 className="font-heading text-lg font-bold text-slate-900">Personal Details</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
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

            {profileError && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 sm:col-span-2">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 sm:col-span-2">
                {profileSuccess}
              </div>
            )}

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
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2">
            <LockIcon className="h-5 w-5 text-blue-600" />
            <h2 className="font-heading text-lg font-bold text-slate-900">Change Password</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {passwordError && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                {passwordSuccess}
              </div>
            )}

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
        <section className="rounded-xl border border-red-200 bg-red-50/50 p-6">
          <h2 className="font-heading text-lg font-bold text-red-900">Danger Zone</h2>
          <p className="mt-1 text-xs text-red-700">
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
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-heading text-lg font-bold text-slate-900">Delete Account Confirmation</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete your driver account? You will immediately be signed out and will lose access to the Driver Portal.
            </p>

            {deleteError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
    </div>
  );
}
