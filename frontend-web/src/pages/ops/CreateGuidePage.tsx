import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage, extractFieldErrors } from '../../api/apiClient';
import { createGuide } from '../../api/guides';

export function CreateGuidePage({ basePath = '/ops/guides' }: { basePath?: string }) {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [languagesStr, setLanguagesStr] = useState('');
  const [specializationsStr, setSpecializationsStr] = useState('');
  const [userId, setUserId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
      await createGuide({
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
        setGeneralError(extractErrorMessage(err, 'Failed to create guide profile.'));
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
        <h2 className="font-heading text-xl font-bold text-slate-900">Create Guide Profile</h2>
        <p className="mt-1 text-sm text-slate-500">
          Register a new professional guide with languages, specializations, and contact details.
        </p>

        {generalError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="guideName" className="block text-xs font-semibold text-slate-700 mb-1">
              Guide Name *
            </label>
            <input
              id="guideName"
              type="text"
              required
              maxLength={200}
              placeholder="e.g. Kasun Perera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="contactInfo" className="block text-xs font-semibold text-slate-700 mb-1">
              Contact Info
            </label>
            <input
              id="contactInfo"
              type="text"
              maxLength={200}
              placeholder="e.g. +94 77 123 4567 / kasun@guide.com"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {fieldErrors.contactInfo && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.contactInfo}</p>
            )}
          </div>

          <div>
            <label htmlFor="languages" className="block text-xs font-semibold text-slate-700 mb-1">
              Languages (comma-separated)
            </label>
            <input
              id="languages"
              type="text"
              placeholder="e.g. English, German, Sinhala"
              value={languagesStr}
              onChange={(e) => setLanguagesStr(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="specializations" className="block text-xs font-semibold text-slate-700 mb-1">
              Specializations (comma-separated)
            </label>
            <input
              id="specializations"
              type="text"
              placeholder="e.g. Hiking, Wildlife, Cultural, Photography"
              value={specializationsStr}
              onChange={(e) => setSpecializationsStr(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="userId" className="block text-xs font-semibold text-slate-700 mb-1">
              Linked User ID (Optional)
            </label>
            <input
              id="userId"
              type="text"
              placeholder="e.g. 00000000-0000-0000-0000-000000000000"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono text-xs"
            />
            {fieldErrors.userId && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.userId}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Attach to an existing TourGuide user account so the guide can access their assigned tours and availability.
            </p>
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
              {submitting ? 'Creating...' : 'Create Guide'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
