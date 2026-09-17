import { useEffect, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  createStaffUser,
  deleteStaffUser,
  getStaff,
  type StaffMember,
  type StaffRole,
} from '../../api/staff';
import { Avatar } from '../../components/Avatar';
import { BriefcaseIcon, CompassIcon, PlusCircleIcon, TruckIcon, UsersIcon } from '../../components/admin/icons';

interface StaffFormState {
  name: string;
  email: string;
  password: string;
  contactNumber: string;
}

function emptyForm(): StaffFormState {
  return { name: '', email: '', password: '', contactNumber: '' };
}

const ROLE_ICONS: Record<StaffRole, typeof CompassIcon> = {
  TourGuide: CompassIcon,
  OperationsManager: BriefcaseIcon,
  FleetCoordinator: TruckIcon,
};

export function StaffRolePage({ role, roleLabel }: { role: StaffRole; roleLabel: string }) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [form, setForm] = useState<StaffFormState>(emptyForm());
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function loadStaff() {
    getStaff()
      .then(setStaff)
      .catch((err) => setListError(extractErrorMessage(err, 'Could not load staff.')));
  }

  useEffect(() => {
    loadStaff();
  }, []);

  const roleStaff = staff?.filter((member) => member.role === role) ?? null;
  const RoleIcon = ROLE_ICONS[role];

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createStaffUser({ ...form, role });
      setForm(emptyForm());
      loadStaff();
    } catch (err) {
      setCreateError(extractErrorMessage(err, `Could not create ${roleLabel.toLowerCase()} account.`));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(member: StaffMember) {
    if (!window.confirm(`Remove ${member.name} (${member.email})? This cannot be undone.`)) {
      return;
    }
    setDeleteError(null);
    setDeletingId(member.id);
    try {
      await deleteStaffUser(member.id);
      loadStaff();
    } catch (err) {
      setDeleteError(extractErrorMessage(err, 'Could not remove this account.'));
    } finally {
      setDeletingId(null);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const labelClass = 'text-xs font-semibold text-slate-600';

  return (
    <div>
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
          <RoleIcon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-900">{roleLabel} accounts</h2>
          <p className="text-sm text-slate-500">
            {roleStaff === null ? 'Loading roster…' : `${roleStaff.length} active ${roleStaff.length === 1 ? 'account' : 'accounts'}`}
          </p>
        </div>
      </div>

      <section className="mb-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <PlusCircleIcon className="h-5 w-5 text-brand-600" />
          <h2 className="font-heading text-lg font-bold text-slate-900">Add a {roleLabel.toLowerCase()}</h2>
        </div>
        <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              required
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <input
              required
              type="password"
              minLength={8}
              className={inputClass}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Contact number</label>
            <input
              required
              type="tel"
              className={inputClass}
              value={form.contactNumber}
              onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <p className={`${inputClass} flex items-center gap-2 bg-brand-50 text-brand-800`}>
              <RoleIcon className="h-4 w-4" /> {roleLabel}
            </p>
          </div>

          {createError && (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
              {createError}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {creating ? 'Creating...' : 'Create account'}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-slate-400" />
          <h2 className="font-heading text-lg font-bold text-slate-900">Existing {roleLabel.toLowerCase()}s</h2>
        </div>

        {listError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {listError}
          </p>
        )}
        {deleteError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {deleteError}
          </p>
        )}

        {roleStaff === null && !listError && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {roleStaff !== null && roleStaff.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <RoleIcon className="h-6 w-6" />
            </div>
            <p className="mt-3 font-medium text-slate-600">No {roleLabel.toLowerCase()} accounts yet.</p>
            <p className="mt-1 text-sm text-slate-400">Use the form above to add the first one.</p>
          </div>
        )}

        {roleStaff && roleStaff.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Contact number</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roleStaff.map((member) => (
                  <tr key={member.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={member.name} size="sm" />
                        <span className="font-medium text-slate-900">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{member.email}</td>
                    <td className="px-4 py-3 text-slate-600">{member.contactNumber}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(member)}
                        disabled={deletingId === member.id}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {deletingId === member.id ? 'Removing...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}