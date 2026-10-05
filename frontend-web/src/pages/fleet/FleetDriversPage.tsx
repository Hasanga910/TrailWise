import { useEffect, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { createDriver, deleteDriver, getDrivers, updateDriver, type DriverDto } from '../../api/vehicles';
import { IdCardIcon, PlusCircleIcon } from '../../components/admin/icons';
import { Avatar, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Skeleton } from '../../components/ui';

interface DriverFieldValues {
  name: string;
  licenseNumber: string;
  contactInfo: string;
  email: string;
  password: string;
}

function DriverFields({
  values,
  onChange,
  emailLabel,
  passwordLabel,
  passwordPlaceholder,
}: {
  values: DriverFieldValues;
  onChange: (patch: Partial<DriverFieldValues>) => void;
  emailLabel: string;
  passwordLabel: string;
  passwordPlaceholder: string;
}) {
  return (
    <>
      <Input label="Full Name" required type="text" placeholder="e.g. Sunil Perera" value={values.name} onChange={(e) => onChange({ name: e.target.value })} />
      <Input label="License Number" required type="text" placeholder="e.g. B-8492019" value={values.licenseNumber} onChange={(e) => onChange({ licenseNumber: e.target.value })} />
      <Input label="Contact Number" type="tel" placeholder="e.g. +94 77 123 4567" value={values.contactInfo} onChange={(e) => onChange({ contactInfo: e.target.value })} />
      <Input label={emailLabel} type="email" placeholder="e.g. driver@example.com" value={values.email} onChange={(e) => onChange({ email: e.target.value })} />
      <Input label={passwordLabel} type="password" placeholder={passwordPlaceholder} value={values.password} onChange={(e) => onChange({ password: e.target.value })} />
    </>
  );
}

export function FleetDriversPage() {
  const [drivers, setDrivers] = useState<DriverDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search/filter
  const [searchTerm, setSearchTerm] = useState('');

  // Add Driver Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit Driver Modal
  const [editingDriver, setEditingDriver] = useState<DriverDto | null>(null);
  const [editName, setEditName] = useState('');
  const [editLicenseNumber, setEditLicenseNumber] = useState('');
  const [editContactInfo, setEditContactInfo] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Delete Driver Modal
  const [deletingDriver, setDeletingDriver] = useState<DriverDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadDrivers() {
    setError(null);
    getDrivers()
      .then((data) => setDrivers(data))
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load drivers.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDrivers();
  }, []);

  async function handleCreateDriver(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createDriver({
        name: name.trim(),
        licenseNumber: licenseNumber.trim(),
        contactInfo: contactInfo.trim(),
        email: email.trim() || undefined,
        password: password || undefined,
      });
      setName('');
      setLicenseNumber('');
      setContactInfo('');
      setEmail('');
      setPassword('');
      setShowModal(false);
      loadDrivers();
    } catch (err) {
      setCreateError(extractErrorMessage(err, 'Failed to register driver.'));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(driver: DriverDto) {
    setEditingDriver(driver);
    setEditName(driver.name);
    setEditLicenseNumber(driver.licenseNumber);
    setEditContactInfo(driver.contactInfo || '');
    setEditEmail(driver.email || '');
    setEditPassword('');
    setEditError(null);
  }

  async function handleUpdateDriver(e: FormEvent) {
    e.preventDefault();
    if (!editingDriver) return;
    setEditError(null);
    setUpdating(true);
    try {
      await updateDriver(editingDriver.id, {
        name: editName.trim(),
        licenseNumber: editLicenseNumber.trim(),
        contactInfo: editContactInfo.trim(),
        email: editEmail.trim() || undefined,
        password: editPassword || undefined,
      });
      setEditingDriver(null);
      loadDrivers();
    } catch (err) {
      setEditError(extractErrorMessage(err, 'Failed to update driver.'));
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteDriver() {
    if (!deletingDriver) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteDriver(deletingDriver.id);
      setDeletingDriver(null);
      loadDrivers();
    } catch (err) {
      setDeleteError(extractErrorMessage(err, 'Failed to delete driver.'));
    } finally {
      setDeleting(false);
    }
  }

  const filteredDrivers = drivers?.filter((d) => {
    const term = searchTerm.toLowerCase();
    return (
      d.name.toLowerCase().includes(term) ||
      d.licenseNumber.toLowerCase().includes(term) ||
      d.contactInfo.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand-text">
            <IdCardIcon className="h-6 w-6" />
          </div>
          <PageHeader
            as="h1"
            title="Driver Roster"
            description="Manage licensed drivers, contact numbers, and transport assignments."
            className="mb-0"
          />
        </div>
        <Button
          leftIcon={<PlusCircleIcon className="h-4 w-4" />}
          onClick={() => {
            setCreateError(null);
            setShowModal(true);
          }}
        >
          Register Driver
        </Button>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Drivers', value: String(drivers?.length ?? 0), color: 'text-fg' },
          { label: 'Active Roster', value: String(drivers?.length ?? 0), color: 'text-success-fg' },
          { label: 'License Verification', value: '100%', color: 'text-brand-text' },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-overline text-fg-muted">{stat.label}</p>
            <p className={`mt-2 font-heading text-h2 ${stat.color}`}>{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          wrapperClassName="w-full sm:w-80"
          type="text"
          aria-label="Search drivers"
          placeholder="Search by name, license, contact..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <p className="text-caption text-fg-muted">
          Showing {filteredDrivers?.length ?? 0} of {drivers?.length ?? 0} drivers
        </p>
      </Card>

      {error && (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-body font-medium text-danger-fg">
          {error}
        </div>
      )}

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6" role="status" aria-label="Loading driver roster">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
            <span className="sr-only">Loading driver roster...</span>
          </div>
        ) : filteredDrivers && filteredDrivers.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-body text-fg-muted">
              <thead className="border-b border-border bg-surface-sunken text-caption font-semibold uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="px-4 py-3.5">Driver Name</th>
                  <th className="px-4 py-3.5">License Number</th>
                  <th className="px-4 py-3.5">Contact Number</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Registered Date</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="transition-colors hover:bg-surface-sunken/50">
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-fg">
                      <div className="flex items-center gap-3">
                        <Avatar name={driver.name} size="sm" />
                        <div>
                          <p className="font-semibold text-fg">{driver.name}</p>
                          <p className="font-mono text-caption text-fg-muted">ID: {driver.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-caption font-semibold text-fg">
                      {driver.licenseNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-fg-muted">
                      {driver.contactInfo || <span className="italic text-fg-muted">Not provided</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <Badge tone="success" className="gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                        Available
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-caption text-fg-muted">
                      {driver.createdAt ? new Date(driver.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => startEdit(driver)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="border-danger/30 text-danger-fg"
                          onClick={() => {
                            setDeleteError(null);
                            setDeletingDriver(driver);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<IdCardIcon className="h-8 w-8" />}
            title="No drivers found."
            description="Register a new driver above to assign them to vehicles."
          />
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        size="sm"
        title="Register New Driver"
        description="Add a driver to the fleet roster for vehicle assignment and tour allocations."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="register-driver-form" disabled={creating}>
              {creating ? 'Saving...' : 'Register Driver'}
            </Button>
          </>
        }
      >
        <form id="register-driver-form" onSubmit={handleCreateDriver} className="space-y-4">
          <DriverFields
            values={{ name, licenseNumber, contactInfo, email, password }}
            onChange={(p) => {
              if (p.name !== undefined) setName(p.name);
              if (p.licenseNumber !== undefined) setLicenseNumber(p.licenseNumber);
              if (p.contactInfo !== undefined) setContactInfo(p.contactInfo);
              if (p.email !== undefined) setEmail(p.email);
              if (p.password !== undefined) setPassword(p.password);
            }}
            emailLabel="Account Email (Optional Login)"
            passwordLabel="Account Password (Optional Login)"
            passwordPlaceholder="Min 6 characters (defaults to ChangeMe123!)"
          />
          {createError && (
            <div role="alert" className="rounded-input bg-danger-soft p-3 text-caption font-medium text-danger-fg">
              {createError}
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={editingDriver !== null}
        onClose={() => setEditingDriver(null)}
        size="sm"
        title="Update Driver Details"
        description="Modify the driver name, license number, or phone contact information."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingDriver(null)}>
              Cancel
            </Button>
            <Button type="submit" form="update-driver-form" disabled={updating}>
              {updating ? 'Saving...' : 'Update Driver'}
            </Button>
          </>
        }
      >
        <form id="update-driver-form" onSubmit={handleUpdateDriver} className="space-y-4">
          <DriverFields
            values={{
              name: editName,
              licenseNumber: editLicenseNumber,
              contactInfo: editContactInfo,
              email: editEmail,
              password: editPassword,
            }}
            onChange={(p) => {
              if (p.name !== undefined) setEditName(p.name);
              if (p.licenseNumber !== undefined) setEditLicenseNumber(p.licenseNumber);
              if (p.contactInfo !== undefined) setEditContactInfo(p.contactInfo);
              if (p.email !== undefined) setEditEmail(p.email);
              if (p.password !== undefined) setEditPassword(p.password);
            }}
            emailLabel="Account Email (Login)"
            passwordLabel="New Password (Leave blank to keep)"
            passwordPlaceholder="Optional new password"
          />
          {editError && (
            <div role="alert" className="rounded-input bg-danger-soft p-3 text-caption font-medium text-danger-fg">
              {editError}
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={deletingDriver !== null}
        onClose={() => setDeletingDriver(null)}
        size="sm"
        title="Delete Driver"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingDriver(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={deleting} onClick={handleDeleteDriver}>
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </>
        }
      >
        {deletingDriver && (
          <p className="text-body text-fg-muted">
            Are you sure you want to remove <strong className="text-fg">{deletingDriver.name}</strong> ({deletingDriver.licenseNumber}) from the fleet roster?
          </p>
        )}
        {deleteError && (
          <div role="alert" className="mt-3 rounded-input bg-danger-soft p-3 text-caption font-medium text-danger-fg">
            {deleteError}
          </div>
        )}
      </Modal>
    </div>
  );
}
