import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { changePassword, deleteSelfProfile, updateProfile } from '../../api/profile';
import { useAuth } from '../../auth/AuthContext';
import { PHONE_MESSAGE, PHONE_PATTERN } from '../../forms/authSchemas';
import { LockIcon, MailIcon } from '../admin/icons';
import { Avatar, Badge, Button, Card, Input, Modal } from '../ui';
import { notify } from '../ui/notify';

export interface DangerZoneConfig {
  description: string;
  buttonLabel: string;
  modalTitle: string;
  modalBody: string;
  confirmLabel: string;
  failureMessage: string;
}

export interface ProfileSettingsProps {
  /** Role shown in the header (and in the read-only Role field when `showRoleField` is set). */
  roleLabel: string;
  /** 'badge' puts the role in a pill under the email; 'inline' appends it to the email line. */
  roleDisplay?: 'badge' | 'inline';
  showRoleField?: boolean;
  detailsHeading?: string;
  detailsHint?: string;
  nameLabel?: string;
  emailLabel?: string;
  contactLabel?: string;
  saveLabel?: string;
  profileSuccess?: string;
  passwordHeading?: string;
  passwordHint?: string;
  currentPasswordLabel?: string;
  newPasswordLabel?: string;
  confirmPasswordLabel?: string;
  minPasswordLength?: number;
  changePasswordLabel?: string;
  changingPasswordLabel?: string;
  passwordSuccess?: string;
  mismatchMessage?: string;
  /** When present, a "Danger Zone" lets the user delete their own account. */
  danger?: DangerZoneConfig;
}

/**
 * Profile and settings page shared by every role: header, personal details, password change and an
 * optional self-delete danger zone. Role pages only supply wording.
 */
export function ProfileSettings({
  roleLabel,
  roleDisplay = 'badge',
  showRoleField = false,
  detailsHeading = 'Profile details',
  detailsHint,
  nameLabel = 'Name',
  emailLabel = 'Email',
  contactLabel = 'Contact number',
  saveLabel = 'Save changes',
  profileSuccess = 'Profile updated.',
  passwordHeading = 'Change password',
  passwordHint,
  currentPasswordLabel = 'Current password',
  newPasswordLabel = 'New password',
  confirmPasswordLabel = 'Confirm new password',
  minPasswordLength = 8,
  changePasswordLabel = 'Change password',
  changingPasswordLabel = 'Saving...',
  passwordSuccess = 'Password changed.',
  mismatchMessage = 'New password and confirmation do not match.',
  danger,
}: ProfileSettingsProps) {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [contactNumber, setContactNumber] = useState(user?.contactNumber ?? '');
  const [contactError, setContactError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!PHONE_PATTERN.test(contactNumber.trim())) {
      setContactError(PHONE_MESSAGE);
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ name, email, contactNumber });
      updateUser(updated);
      notify.success(profileSuccess);
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Could not update profile.'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setConfirmError(mismatchMessage);
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify.success(passwordSuccess);
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
      setDeleteError(extractErrorMessage(err, danger?.failureMessage ?? 'Failed to delete account.'));
      setDeletingAccount(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="mb-8 flex items-center gap-5 bg-gradient-to-br from-brand-soft to-surface-raised p-6">
        <Avatar name={user?.name ?? roleLabel} size="lg" />
        <div className="min-w-0">
          <h2 className="font-heading text-h2 text-fg">{user?.name}</h2>
          {roleDisplay === 'inline' ? (
            <p className="text-body text-fg-muted [overflow-wrap:anywhere]">
              {user?.email} • {roleLabel}
            </p>
          ) : (
            <>
              <p className="text-body text-fg-muted [overflow-wrap:anywhere]">{user?.email}</p>
              {user && (
                <Badge tone="brand" className="mt-2">
                  {roleLabel}
                </Badge>
              )}
            </>
          )}
        </div>
      </Card>

      <Card className="mb-8 p-6">
        <div className="flex items-center gap-2">
          <MailIcon className="h-5 w-5 text-brand-text" />
          <h2 className="font-heading text-h3 text-fg">{detailsHeading}</h2>
        </div>
        {detailsHint && <p className="mt-1 text-caption text-fg-muted">{detailsHint}</p>}
        <form onSubmit={handleSaveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label={nameLabel} required value={name} onChange={(e) => setName(e.target.value)} />
          <Input label={emailLabel} required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            label={contactLabel}
            required
            type="tel"
            value={contactNumber}
            error={contactError ?? undefined}
            onChange={(e) => {
              setContactNumber(e.target.value);
              setContactError(null);
            }}
          />
          {showRoleField && (
            <div>
              <p className="mb-1 text-caption font-semibold text-fg">Role</p>
              <p className="cursor-not-allowed rounded-input border border-border bg-surface-sunken px-3 py-2 text-body text-fg-muted">
                {roleLabel}
              </p>
            </div>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving...' : saveLabel}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <LockIcon className="h-5 w-5 text-brand-text" />
          <h2 className="font-heading text-h3 text-fg">{passwordHeading}</h2>
        </div>
        {passwordHint && <p className="mt-1 text-caption text-fg-muted">{passwordHint}</p>}
        <form onSubmit={handleChangePassword} className="mt-4 grid gap-4 sm:grid-cols-3">
          <Input
            label={currentPasswordLabel}
            required
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label={newPasswordLabel}
            required
            type="password"
            minLength={minPasswordLength}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label={confirmPasswordLabel}
            required
            type="password"
            minLength={minPasswordLength}
            value={confirmPassword}
            error={confirmError ?? undefined}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setConfirmError(null);
            }}
          />

          <div className="sm:col-span-3">
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? changingPasswordLabel : changePasswordLabel}
            </Button>
          </div>
        </form>
      </Card>

      {danger && (
        <>
          <Card className="mt-10 border-danger/30 bg-danger-soft/40 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-heading text-h3 text-danger-fg">Danger Zone</h2>
                <p className="mt-1 text-body text-danger-fg">{danger.description}</p>
              </div>
              <Button
                variant="secondary"
                className="border-danger/30 text-danger-fg"
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
              >
                {danger.buttonLabel}
              </Button>
            </div>
          </Card>

          <Modal
            open={showDeleteModal}
            onClose={() => {
              if (!deletingAccount) setShowDeleteModal(false);
            }}
            size="sm"
            title={danger.modalTitle}
            footer={
              <>
                <Button variant="secondary" disabled={deletingAccount} onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </Button>
                <Button variant="danger" disabled={deletingAccount} onClick={handleDeleteAccount}>
                  {deletingAccount ? 'Deleting...' : danger.confirmLabel}
                </Button>
              </>
            }
          >
            <p className="text-body text-fg-muted">{danger.modalBody}</p>
            {deleteError && (
              <div role="alert" className="mt-4 rounded-input bg-danger-soft p-3 text-caption font-medium text-danger-fg">
                {deleteError}
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  );
}
