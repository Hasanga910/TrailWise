import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { extractErrorMessage, extractFieldErrors } from '../../api/apiClient';
import { getGuideById, updateGuide, type GuideDto } from '../../api/guides';

export function EditGuidePage({ basePath = '/ops/guides' }: { basePath?: string }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [guide, setGuide] = useState<GuideDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [languagesStr, setLanguagesStr] = useState('');
  const [specializationsStr, setSpecializationsStr] = useState('');
  const [userId, setUserId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    getGuideById(id)
      .then((data) => {
        setGuide(data);
        setName(data.name);
        setContactInfo(data.contactInfo ?? '');
        setLanguagesStr(data.languages.join(', '));
        setSpecializationsStr(data.specializations.join(', '));
        setUserId(data.userId ?? '');
      })
      .catch((err) => {
        setLoadError(extractErrorMessage(err, 'Failed to load guide details.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    setGeneralError(null);
    setFieldErrors({});

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFieldErrors({ name: 'Guide name is required.' });
      return;
    }
    if (trimmedName.length > 200) {
      setFieldErrors({ name: 'Guide name cannot exceed 200 characters.' });
      return;
    }
    if (contactInfo.trim().length > 200) {
      setFieldErrors({ contactInfo: 'Contact info cannot exceed 200 characters.' });
      return;
    }

    const languages = languagesStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const specializations = specializationsStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const parsedUserId = userId.trim() ? userId.trim() : null;

    setSubmitting(true);
    try {
      await updateGuide(id, {
        name: trimmedName,
        contactInfo: contactInfo.trim(),
        languages,
        specializations,
        userId: parsedUserId,
      });
      navigate(basePath);
    } catch (err) {
      const extractedFields = extractFieldErrors(err);
      if (Object.keys(extractedFields).length > 0) {
        setFieldErrors(extractedFields);
      } else {
        setGeneralError(extractErrorMessage(err, 'Failed to update guide profile.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(basePath)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          ← Back to Guides
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="font-heading text-xl font-bold text-slate-900">Edit Guide Profile</h2>
        <p className="mt-1 text-sm text-slate-500">
          Update the profile details, languages, and specializations for this guide.
        </p>

        {loading && (
          <div className="flex min-h-48 items-center justify-center">
            <span className="text-sm text-slate-500">Loading guide details...</span>
          </div>
        )}

        {loadError && !loading && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">Error</p>
            <p className="mt-1">{loadError}</p>
          </div>
        )}

        {generalError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {generalError}
          </div>
        )}

        {!loading && !loadError && guide && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="editGuideName" className="block text-xs font-semibold text-slate-700 mb-1">
                Guide Name *
              </label>
              <input
                id="editGuideName"
                type="text"
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="editContactInfo" className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Info
              </label>
              <input
                id="editContactInfo"
                type="text"
                maxLength={200}
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {fieldErrors.contactInfo && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.contactInfo}</p>
              )}
            </div>

            <div>
              <label htmlFor="editLanguages" className="block text-xs font-semibold text-slate-700 mb-1">
                Languages (comma-separated)
              </label>
              <input
                id="editLanguages"
                type="text"
                value={languagesStr}
                onChange={(e) => setLanguagesStr(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="editSpecializations" className="block text-xs font-semibold text-slate-700 mb-1">
                Specializations (comma-separated)
              </label>
              <input
                id="editSpecializations"
                type="text"
                value={specializationsStr}
                onChange={(e) => setSpecializationsStr(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="editUserId" className="block text-xs font-semibold text-slate-700 mb-1">
                Linked User ID (Optional)
              </label>
              <input
                id="editUserId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono text-xs"
              />
              {fieldErrors.userId && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.userId}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => navigate(basePath)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
