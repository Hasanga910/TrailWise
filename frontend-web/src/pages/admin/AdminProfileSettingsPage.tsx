import { useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { changePassword, updateProfile } from '../../api/profile';
import { useAuth } from '../../auth/AuthContext';
import { Avatar } from '../../components/Avatar';
import { LockIcon, MailIcon } from '../../components/admin/icons';

const ROLE_LABEL = 'Administrator';

export function AdminProfileSettingsPage() {
  const { user, updateUser } = useAuth();

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

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const labelClass = 'text-xs font-semibold text-slate-600';

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ name, email, contactNumber });
      updateUser(updated);
      setProfileSuccess('Profile updated.');
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
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password changed.');
    } catch (err) {
      setPasswordError(extractErrorMessage(err, 'Could not change password.'));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-6">
        {user && <Avatar name={user.name} size="lg" />}
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900">{user?.name}</h2>
          <p className="text-sm text-slate-500">{user?.email}</p>
          {user && (
            <span className="mt-2 inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800">
              {ROLE_LABEL}
            </span>
          )}
        </div>
      </div>

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <MailIcon className="h-5 w-5 text-brand-600" />
          <h2 className="font-heading text-lg font-bold text-slate-900">Profile details</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
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

          {profileError && (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
              {profileError}
            </p>
          )}
          {profileSuccess && (
            <p className="sm:col-span-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
              {profileSuccess}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {savingProfile ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <LockIcon className="h-5 w-5 text-brand-600" />
          <h2 className="font-heading text-lg font-bold text-slate-900">Change password</h2>
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
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {passwordError && (
            <p className="sm:col-span-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
              {passwordError}
            </p>
          )}
          {passwordSuccess && (
            <p className="sm:col-span-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
              {passwordSuccess}
            </p>
          )}

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {savingPassword ? 'Saving...' : 'Change password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
