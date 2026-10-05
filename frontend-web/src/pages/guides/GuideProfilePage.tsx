import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import {
  deleteMyGuideProfile,
  getMyGuideProfile,
  updateMyGuideProfile,
  type GuideProfileDto,
} from '../../api/guides';
import { changePassword } from '../../api/profile';
import { useAuth } from '../../auth/AuthContext';
import { LockIcon, MailIcon } from '../../components/admin/icons';
import { LanguagePicker } from '../../components/guides/LanguagePicker';
import { SpecializationInput } from '../../components/guides/SpecializationInput';
import { Avatar, Badge, Button, Card, Input, Modal, Skeleton } from '../../components/ui';
import { notify } from '../../components/ui/notify';

export function GuideProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  const [languages, setLanguages] = useState<string[]>([]);
  const [languageError, setLanguageError] = useState<string | null>(null);

  const [specializations, setSpecializations] = useState<string[]>([]);
  const [specializationError, setSpecializationError] = useState<string | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function populateForm(data: GuideProfileDto) {
    setName(data.name || '');
    setEmail(data.email || '');
    setContactInfo(data.contactInfo || '');
    setLanguages(data.languages || []);
    setSpecializations(data.specializations || []);
    setLanguageError(null);
    setSpecializationError(null);
  }

  async function loadProfile() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getMyGuideProfile();
      populateForm(data);
    } catch (err) {
      setLoadError(extractErrorMessage(err, 'Failed to load your profile.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  function addLanguage(langToAdd: string) {
    const trimmed = langToAdd.trim();
    if (!trimmed) return;
    if (languages.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      setLanguageError(`"${trimmed}" is already added.`);
      return;
    }
    setLanguageError(null);
    setLanguages((prev) => [...prev, trimmed]);
  }

  function removeLanguage(langToRemove: string) {
    setLanguages((prev) => prev.filter((l) => l.toLowerCase() !== langToRemove.toLowerCase()));
    setLanguageError(null);
  }

  function addSpecialization(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (specializations.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSpecializationError(`"${trimmed}" is already added.`);
      return false;
    }
    setSpecializationError(null);
    setSpecializations((prev) => [...prev, trimmed]);
    return true;
  }

  function removeSpecialization(specToRemove: string) {
    setSpecializations((prev) => prev.filter((s) => s.toLowerCase() !== specToRemove.toLowerCase()));
    setSpecializationError(null);
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const updated = await updateMyGuideProfile({
        name: name.trim(),
        email: email.trim(),
        contactInfo: contactInfo.trim(),
        languages: languages,
        specializations: specializations,
      });

      populateForm(updated);
      notify.success('Profile updated successfully.');

      if (user) {
        updateUser({
          ...user,
          name: updated.name,
          email: updated.email,
          contactNumber: updated.contactInfo,
        });
      }
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Could not update profile.');
      notify.error(msg);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setConfirmError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 6) {
      notify.error('New password must be at least 6 characters.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify.success('Password updated successfully.');
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Could not change password.'));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDeleteProfile() {
    setDeleteError(null);
    setDeletingProfile(true);

    try {
      await deleteMyGuideProfile();
      setShowDeleteModal(false);
      logout();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const axiosStatus = (err as { response?: { status?: number } })?.response?.status;
      const rawMsg = extractErrorMessage(err, 'Could not delete profile.');
      if (
        axiosStatus === 409 ||
        rawMsg.toLowerCase().includes('assigned tour') ||
        rawMsg.includes('409')
      ) {
        setDeleteError('Guide profile cannot be deleted while assigned tours exist.');
      } else {
        setDeleteError(rawMsg);
      }
    } finally {
      setDeletingProfile(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {loading ? (
        <div className="space-y-3 py-10" role="status" aria-label="Loading profile">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
          <p className="text-center text-body text-fg-muted">Loading profile...</p>
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-6 text-center text-danger-fg">
          <p className="text-body font-semibold">Failed to load profile</p>
          <p className="mt-1 text-caption">{loadError}</p>
          <Button variant="danger" className="mt-4" onClick={loadProfile}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <Card className="mb-6 flex items-center gap-4 bg-gradient-to-br from-brand-soft to-surface-raised">
            <Avatar name={name || user?.name || 'Guide'} size="lg" />
            <div className="min-w-0">
              <h2 className="font-heading text-h3 text-fg">{name || user?.name}</h2>
              <p className="text-body text-fg-muted [overflow-wrap:anywhere]">{email || user?.email}</p>
              <Badge tone="success" className="mt-2">
                ROLE: TOUR GUIDE
              </Badge>
            </div>
          </Card>

          <Card className="mb-8 p-6">
            <div className="flex items-center gap-2">
              <MailIcon className="h-5 w-5 text-brand-text" />
              <h2 className="font-heading text-h3 text-fg">Personal Details</h2>
            </div>
            <p className="mt-1 text-caption text-fg-muted">
              Update your guide name, email address, contact information, languages, and specializations.
            </p>

            <form onSubmit={handleSaveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Full Name" required value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Email Address" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input
                wrapperClassName="sm:col-span-2"
                label="Contact / Mobile Number"
                type="tel"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
              />

              <div className="sm:col-span-2">
                <p className="text-caption font-semibold text-fg">Languages</p>
                <p className="mb-2 text-caption text-fg-muted">Select languages you can fluently guide in.</p>
                <LanguagePicker languages={languages} error={languageError} onSelect={addLanguage} onRemove={removeLanguage} />
              </div>

              <div className="sm:col-span-2">
                <p className="text-caption font-semibold text-fg">Specializations</p>
                <p className="mb-2 text-caption text-fg-muted">
                  Add tour guide specializations (e.g. Cultural, Hiking, Wildlife).
                </p>
                <SpecializationInput
                  specializations={specializations}
                  error={specializationError}
                  onAdd={addSpecialization}
                  onRemove={removeSpecialization}
                  onEdit={() => setSpecializationError(null)}
                />
              </div>

              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="mb-8 p-6">
            <div className="flex items-center gap-2">
              <LockIcon className="h-5 w-5 text-brand-text" />
              <h2 className="font-heading text-h3 text-fg">Change Password</h2>
            </div>
            <p className="mt-1 text-caption text-fg-muted">Update your account password with at least 6 characters.</p>

            <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
              <Input
                label="Current Password"
                required
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="New Password"
                  required
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  label="Confirm New Password"
                  required
                  type="password"
                  minLength={6}
                  value={confirmPassword}
                  error={confirmError ?? undefined}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setConfirmError(null);
                  }}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword ? 'Updating...' : 'Change Password'}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="border-danger/30 bg-danger-soft/50 p-6">
            <h2 className="font-heading text-h3 text-danger-fg">Delete Profile</h2>
            <p className="mt-1 text-caption text-danger-fg">
              You cannot delete your Tour Guide profile while tours are assigned to you.
            </p>
            <Button
              variant="danger"
              className="mt-4"
              onClick={() => {
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
            >
              Delete Profile
            </Button>
          </Card>
        </>
      )}

      <Modal
        open={showDeleteModal}
        onClose={() => {
          if (!deletingProfile) setShowDeleteModal(false);
        }}
        size="sm"
        title="Delete Profile Confirmation"
        footer={
          <>
            <Button variant="secondary" disabled={deletingProfile} onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={deletingProfile} onClick={handleDeleteProfile}>
              {deletingProfile ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-body text-fg-muted">
          Are you sure you want to delete your Tour Guide profile? This permanently removes your account and profile data. You cannot delete your profile while tours are assigned to you.
        </p>
        {deleteError && (
          <div role="alert" className="mt-3 rounded-input border border-danger/30 bg-danger-soft p-3 text-caption font-semibold text-danger-fg">
            {deleteError}
          </div>
        )}
      </Modal>
    </div>
  );
}
