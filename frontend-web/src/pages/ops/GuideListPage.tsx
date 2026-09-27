import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getGuides, type GuideDto } from '../../api/guides';

export function GuideListPage({ basePath = '/ops/guides' }: { basePath?: string }) {
  const navigate = useNavigate();
  const [guides, setGuides] = useState<GuideDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');

  function loadGuides() {
    setLoading(true);
    setError(null);
    getGuides(specializationFilter || undefined, languageFilter || undefined)
      .then((data) => {
        setGuides(data);
      })
      .catch((err) => {
        setError(extractErrorMessage(err, 'Failed to load guides.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    loadGuides();
  }, [specializationFilter, languageFilter]);

  const filteredGuides = guides.filter((g) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      g.name.toLowerCase().includes(term) ||
      g.contactInfo.toLowerCase().includes(term) ||
      g.languages.some((l) => l.toLowerCase().includes(term)) ||
      g.specializations.some((s) => s.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900">Tour Guides</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage professional tour guide profiles, languages, specializations, and schedules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/guides/availability"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            Guide Availability
          </Link>
          <Link
            to={`${basePath}/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700"
          >
            + Add New Guide
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="guideSearch" className="block text-xs font-semibold text-slate-600 mb-1">
            Search
          </label>
          <input
            id="guideSearch"
            type="text"
            placeholder="Search by name, contact, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label htmlFor="specFilter" className="block text-xs font-semibold text-slate-600 mb-1">
            Specialization
          </label>
          <input
            id="specFilter"
            type="text"
            placeholder="Filter by specialization..."
            value={specializationFilter}
            onChange={(e) => setSpecializationFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label htmlFor="langFilter" className="block text-xs font-semibold text-slate-600 mb-1">
            Language
          </label>
          <input
            id="langFilter"
            type="text"
            placeholder="Filter by language..."
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {loading && (
        <div className="flex min-h-60 items-center justify-center rounded-xl border border-slate-200 bg-white p-8">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
              aria-hidden="true"
            />
            <span>Loading guides...</span>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Unable to load guides</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={loadGuides}
            className="mt-3 inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filteredGuides.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="font-semibold text-slate-800">No guides found</p>
          <p className="mt-1 text-sm text-slate-500">
            {guides.length === 0
              ? 'No guide profiles have been created yet. Click "+ Add New Guide" to create one.'
              : 'No guides match your search filters.'}
          </p>
        </div>
      )}

      {!loading && !error && filteredGuides.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3.5">Guide Name</th>
                  <th className="px-6 py-3.5">Contact Info</th>
                  <th className="px-6 py-3.5">Languages</th>
                  <th className="px-6 py-3.5">Specializations</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGuides.map((guide) => (
                  <tr key={guide.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{guide.name}</div>
                      {guide.userId && (
                        <div className="text-xs text-slate-400 font-mono">Linked User ID</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {guide.contactInfo || <span className="text-slate-400 italic">None</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {guide.languages.length > 0 ? (
                          guide.languages.map((lang) => (
                            <span
                              key={lang}
                              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              {lang}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-xs">None listed</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {guide.specializations.length > 0 ? (
                          guide.specializations.map((spec) => (
                            <span
                              key={spec}
                              className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                            >
                              {spec}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-xs">None listed</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`${basePath}/${guide.id}/edit`)}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
