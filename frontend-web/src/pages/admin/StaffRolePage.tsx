import { useEffect, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  createStaffUser,
  deleteStaffUser,
  getStaff,
  type StaffMember,
  type StaffRole,
} from '../../api/staff';
import { Avatar, Button, Card, EmptyState, Input, Skeleton } from '../../components/ui';
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
  Driver: TruckIcon,
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

  return (
    <div>
      <Card className="mb-6 flex items-center gap-4 bg-gradient-to-br from-brand-soft to-surface-raised">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
          <RoleIcon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-heading text-h3 text-fg">{roleLabel} accounts</h2>
          <p className="text-body text-fg-muted">
            {roleStaff === null ? 'Loading roster…' : `${roleStaff.length} active ${roleStaff.length === 1 ? 'account' : 'accounts'}`}
          </p>
        </div>
      </Card>

      <Card className="mb-10 p-6">
        <div className="flex items-center gap-2">
          <PlusCircleIcon className="h-5 w-5 text-brand-text" />
          <h2 className="font-heading text-h3 text-fg">Add a {roleLabel.toLowerCase()}</h2>
        </div>
        <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label="Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Email" required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input
            label="Password"
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <Input
            label="Contact number"
            required
            type="tel"
            value={form.contactNumber}
            onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
          />
          <div>
            <p className="mb-1 text-caption font-semibold text-fg">Role</p>
            <p className="flex items-center gap-2 rounded-input border border-border bg-brand-soft px-3 py-2 text-body text-brand-fg">
              <RoleIcon className="h-4 w-4" /> {roleLabel}
            </p>
          </div>

          {createError && (
            <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-4 py-2 text-body font-medium text-danger-fg sm:col-span-2">
              {createError}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create account'}
            </Button>
          </div>
        </form>
      </Card>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-fg-muted" />
          <h2 className="font-heading text-h3 text-fg">Existing {roleLabel.toLowerCase()}s</h2>
        </div>

        {listError && (
          <p role="alert" className="mb-4 rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
            {listError}
          </p>
        )}
        {deleteError && (
          <p role="alert" className="mb-4 rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
            {deleteError}
          </p>
        )}

        {roleStaff === null && !listError && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-card border border-border bg-surface-raised" />
            ))}
          </div>
        )}

        {roleStaff !== null && roleStaff.length === 0 && (
          <Card padded={false} className="border-dashed">
            <EmptyState
              icon={<RoleIcon className="h-8 w-8" />}
              title={`No ${roleLabel.toLowerCase()} accounts yet.`}
              description="Use the form above to add the first one."
            />
          </Card>
        )}

        {roleStaff && roleStaff.length > 0 && (
          <Card padded={false} className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-left text-caption font-semibold uppercase tracking-wide text-fg-muted">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Contact number</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roleStaff.map((member) => (
                  <tr key={member.id} className="transition hover:bg-surface-sunken">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={member.name} size="sm" />
                        <span className="font-medium text-fg">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{member.email}</td>
                    <td className="px-4 py-3 text-fg-muted">{member.contactNumber}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="border-danger/30 text-danger-fg"
                        onClick={() => handleDelete(member)}
                        disabled={deletingId === member.id}
                      >
                        {deletingId === member.id ? 'Removing...' : 'Delete'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
