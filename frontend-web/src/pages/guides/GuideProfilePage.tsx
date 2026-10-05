import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import {
  AVAILABLE_LANGUAGES,
  deleteMyGuideProfile,
  getMyGuideProfile,
  updateMyGuideProfile,
  type GuideProfileDto,
} from '../../api/guides';
import { changePassword } from '../../api/profile';
import { useAuth } from '../../auth/AuthContext';
import { Avatar } from '../../components/Avatar';
import { LockIcon, MailIcon } from '../../components/admin/icons';
import { notify } from '../../components/ui/notify';

export function GuideProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  // Languages: array of strings + searchable combobox state
  const [languages, setLanguages] = useState<string[]>([]);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [languageError, setLanguageError] = useState<string | null>(null);
  const langPickerRef = useRef<HTMLDivElement>(null);

  // Specializations: array of strings + tag input state
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [specializationInput, setSpecializationInput] = useState('');
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

  const inputClass =
    'w-full rounded-lg border border-border px-3 py-2 text-sm text-fg focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const labelClass = 'text-xs font-semibold text-fg-muted';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langPickerRef.current && !langPickerRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function populateForm(data: GuideProfileDto) {
    setName(data.name || '');
    setEmail(data.email || '');
    setContactInfo(data.contactInfo || '');
    setLanguages(data.languages || []);
    setSpecializations(data.specializations || []);
    setLangSearch('');
    setIsLangOpen(false);
    setSpecializationInput('');
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

  function handleSelectLanguage(lang: string) {
    addLanguage(lang);
    setLangSearch('');
    setIsLangOpen(false);
  }

  const trimmedLangSearch = langSearch.trim().toLowerCase();
  const filteredLanguages = AVAILABLE_LANGUAGES.filter((lang) => {
    if (!trimmedLangSearch) return true;
    return lang.toLowerCase().includes(trimmedLangSearch);
  });

  function addSpecialization(valueToAdd?: string) {
    const raw = valueToAdd !== undefined ? valueToAdd : specializationInput;
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (specializations.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSpecializationError(`"${trimmed}" is already added.`);
      return;
    }
    setSpecializationError(null);
    setSpecializations((prev) => [...prev, trimmed]);
    setSpecializationInput('');
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
    <>
    <div className="mx-auto max-w-3xl">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-fg-muted">
            <p className="text-sm">Loading profile...</p>
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-6 text-center text-danger-fg">
            <p className="text-sm font-semibold">Failed to load profile</p>
            <p className="mt-1 text-xs">{loadError}</p>
            <button
              onClick={loadProfile}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Profile Card Banner */}
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-brand-soft to-surface-raised p-5 shadow-xs">
              <Avatar name={name || user?.name || 'Guide'} size="lg" />
              <div>
                <h2 className="font-heading text-lg font-bold text-fg">
                  {name || user?.name}
                </h2>
                <p className="text-sm text-fg-muted">{email || user?.email}</p>
                <span className="mt-2 inline-flex items-center rounded-full bg-success-soft border border-success/30 px-2.5 py-0.5 text-xs font-semibold text-success-fg">
                  ROLE: TOUR GUIDE
                </span>
              </div>
            </div>

            {/* Personal Details Section */}
            <section className="mb-8 rounded-xl border border-border bg-surface-raised p-6 shadow-xs">
              <div className="flex items-center gap-2">
                <MailIcon className="h-5 w-5 text-brand-text" />
                <h2 className="font-heading text-lg font-bold text-fg">Personal Details</h2>
              </div>
              <p className="mt-1 text-xs text-fg-muted">
                Update your guide name, email address, contact information, languages, and specializations.
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
                    type="tel"
                    className={inputClass}
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Languages</label>
                  <p className="mb-2 text-xs text-fg-muted">
                    Select languages you can fluently guide in.
                  </p>

                  {/* Languages Chips */}
                  <div className="mb-2 flex flex-wrap gap-2" data-testid="language-chips">
                    {languages.map((lang) => (
                      <span
                        key={lang}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft border border-brand-500/30 px-3 py-1 text-xs font-semibold text-brand-fg shadow-2xs"
                      >
                        <span>{lang}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${lang}`}
                          onClick={() => removeLanguage(lang)}
                          className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-brand-text hover:bg-brand-soft hover:text-brand-fg transition font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {languages.length === 0 && (
                      <span className="text-xs italic text-fg-muted">No languages selected yet.</span>
                    )}
                  </div>

                  {/* Searchable Language Combobox */}
                  <div ref={langPickerRef} className="relative">
                    <div className="relative">
                      <input
                        type="text"
                        role="combobox"
                        aria-expanded={isLangOpen}
                        aria-label="Search languages..."
                        placeholder="Search languages..."
                        className={inputClass}
                        value={langSearch}
                        onFocus={() => setIsLangOpen(true)}
                        onClick={() => setIsLangOpen(true)}
                        onChange={(e) => {
                          setLangSearch(e.target.value);
                          if (!isLangOpen) setIsLangOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setIsLangOpen(false);
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredLanguages.length > 0) {
                              const firstAvailable =
                                filteredLanguages.find(
                                  (l) => !languages.some((sel) => sel.toLowerCase() === l.toLowerCase()),
                                ) ?? filteredLanguages[0];
                              handleSelectLanguage(firstAvailable);
                            }
                          }
                        }}
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <svg className="h-4 w-4 text-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Filtered Dropdown Menu */}
                    {isLangOpen && (
                      <div
                        role="listbox"
                        data-testid="language-dropdown"
                        className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-surface-raised py-1 shadow-lg focus:outline-none"
                      >
                        {filteredLanguages.length === 0 ? (
                          <div className="px-4 py-3 text-center text-xs text-fg-muted">
                            No languages found
                          </div>
                        ) : (
                          filteredLanguages.map((lang) => {
                            const isSelected = languages.some(
                              (l) => l.toLowerCase() === lang.toLowerCase(),
                            );
                            return (
                              <button
                                key={lang}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                disabled={isSelected}
                                onClick={() => handleSelectLanguage(lang)}
                                className={`flex w-full items-center justify-between px-4 py-2 text-left text-xs transition ${
                                  isSelected
                                    ? 'cursor-not-allowed bg-surface-sunken text-fg-muted'
                                    : 'text-fg hover:bg-brand-soft hover:text-brand-fg cursor-pointer'
                                }`}
                              >
                                <span>{lang}</span>
                                {isSelected && (
                                  <span className="text-[11px] font-medium text-brand-text">Selected</span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  {languageError && (
                    <p className="mt-1 text-xs text-danger font-medium">{languageError}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Specializations</label>
                  <p className="mb-2 text-xs text-fg-muted">
                    Add tour guide specializations (e.g. Cultural, Hiking, Wildlife).
                  </p>

                  {/* Specialization Chips */}
                  <div className="mb-2 flex flex-wrap gap-2" data-testid="specialization-chips">
                    {specializations.map((spec) => (
                      <span
                        key={spec}
                        className="inline-flex items-center gap-1.5 rounded-full bg-neutral-soft border border-border px-3 py-1 text-xs font-semibold text-fg shadow-2xs"
                      >
                        <span>{spec}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${spec}`}
                          onClick={() => removeSpecialization(spec)}
                          className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-fg-muted hover:bg-border hover:text-fg transition font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {specializations.length === 0 && (
                      <span className="text-xs italic text-fg-muted">No specializations added yet.</span>
                    )}
                  </div>

                  {/* Free-text Tag Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      aria-label="Add Specialization"
                      data-testid="specialization-input"
                      placeholder="e.g. Wildlife, Hiking, Cultural"
                      className={inputClass}
                      value={specializationInput}
                      onChange={(e) => {
                        setSpecializationInput(e.target.value);
                        if (specializationError) setSpecializationError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSpecialization();
                        }
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Add Specialization Button"
                      onClick={() => addSpecialization()}
                      className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-fg hover:bg-surface-sunken transition shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                  {specializationError && (
                    <p className="mt-1 text-xs text-danger font-medium">{specializationError}</p>
                  )}
                </div>

                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-800 disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </section>

            {/* Change Password Section */}
            <section className="mb-8 rounded-xl border border-border bg-surface-raised p-6 shadow-xs">
              <div className="flex items-center gap-2">
                <LockIcon className="h-5 w-5 text-brand-text" />
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
                    className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-800 disabled:opacity-50"
                  >
                    {savingPassword ? 'Updating...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </section>

            {/* Danger Zone: Delete Profile */}
            <section className="rounded-xl border border-danger/30 bg-danger-soft/50 p-6">
              <h2 className="font-heading text-lg font-bold text-danger-fg">Delete Profile</h2>
              <p className="mt-1 text-xs text-danger-fg">
                You cannot delete your Tour Guide profile while tours are assigned to you.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setShowDeleteModal(true);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700"
                >
                  Delete Profile
                </button>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-xl">
            <h3 className="font-heading text-lg font-bold text-fg">
              Delete Profile Confirmation
            </h3>
            <p className="mt-2 text-sm text-fg-muted">
              Are you sure you want to delete your Tour Guide profile? This permanently removes your account and profile data. You cannot delete your profile while tours are assigned to you.
            </p>

            {deleteError && (
              <div role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs font-semibold text-danger-fg">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deletingProfile}
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-sunken"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingProfile}
                onClick={handleDeleteProfile}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingProfile ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
