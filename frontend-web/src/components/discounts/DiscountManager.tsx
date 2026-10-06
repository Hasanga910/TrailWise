import { useEffect, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  createDiscount,
  deleteDiscount,
  getDiscounts,
  toggleDiscountActive,
  updateDiscount,
  type CreateDiscountRequest,
  type DiscountDto,
  type UpdateDiscountRequest,
} from '../../api/discounts';

import { Badge, Button, Card, Checkbox, EmptyState, Input, PageHeader, Skeleton, type BadgeTone } from '../ui';

const STATUS_TONES: Record<DerivedStatus, BadgeTone> = {
  Active: 'success',
  Upcoming: 'info',
  Expired: 'warning',
  Inactive: 'neutral',
};

export type DerivedStatus = 'Active' | 'Inactive' | 'Upcoming' | 'Expired';

export function getDerivedStatus(
  discount: Pick<DiscountDto, 'isActive' | 'validFrom' | 'validUntil'>,
  now: Date = new Date(),
): DerivedStatus {
  if (!discount.isActive) return 'Inactive';
  const nowMs = now.getTime();
  if (discount.validFrom && new Date(discount.validFrom).getTime() > nowMs) {
    return 'Upcoming';
  }
  if (discount.validUntil && new Date(discount.validUntil).getTime() < nowMs) {
    return 'Expired';
  }
  return 'Active';
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatValidity(validFrom: string | null, validUntil: string | null): string {
  if (!validFrom && !validUntil) return 'Always available';
  const formatD = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  if (validFrom && !validUntil) return `From ${formatD(validFrom)}`;
  if (!validFrom && validUntil) return `Until ${formatD(validUntil)}`;
  return `${formatD(validFrom!)} - ${formatD(validUntil!)}`;
}

interface FormState {
  description: string;
  percentageOff: number;
  minGroupSize: number;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
}

function emptyForm(): FormState {
  return {
    description: '',
    percentageOff: 0,
    minGroupSize: 1,
    isActive: true,
    validFrom: '',
    validUntil: '',
  };
}

export function DiscountManager() {
  const [discounts, setDiscounts] = useState<DiscountDto[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function loadDiscounts() {
    getDiscounts()
      .then((data) => {
        setDiscounts(data);
        setListError(null);
      })
      .catch((err) => setListError(extractErrorMessage(err, 'Could not load discounts.')));
  }

  useEffect(() => {
    loadDiscounts();
  }, []);

  function startEdit(discount: DiscountDto) {
    setEditingId(discount.id);
    setForm({
      description: discount.description,
      percentageOff: discount.percentageOff,
      minGroupSize: discount.minGroupSize,
      isActive: discount.isActive,
      validFrom: toDatetimeLocal(discount.validFrom),
      validUntil: toDatetimeLocal(discount.validUntil),
    });
    setFormError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (form.validFrom && form.validUntil) {
      const fromTime = new Date(form.validFrom).getTime();
      const untilTime = new Date(form.validUntil).getTime();
      if (untilTime < fromTime) {
        setFormError('Valid until must be after or equal to valid from.');
        return;
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        const updatePayload: UpdateDiscountRequest = {
          description: form.description.trim(),
          percentageOff: form.percentageOff,
          minGroupSize: form.minGroupSize,
          isActive: form.isActive,
          validFrom: fromDatetimeLocal(form.validFrom),
          validUntil: fromDatetimeLocal(form.validUntil),
        };
        await updateDiscount(editingId, updatePayload);
        setEditingId(null);
      } else {
        const createPayload: CreateDiscountRequest = {
          description: form.description.trim(),
          percentageOff: form.percentageOff,
          minGroupSize: form.minGroupSize,
          isActive: form.isActive,
          validFrom: fromDatetimeLocal(form.validFrom),
          validUntil: fromDatetimeLocal(form.validUntil),
        };
        await createDiscount(createPayload);
      }
      setForm(emptyForm());
      loadDiscounts();
    } catch (err) {
      setFormError(extractErrorMessage(err, editingId ? 'Could not update discount.' : 'Could not create discount.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(discount: DiscountDto) {
    setTogglingId(discount.id);
    setListError(null);
    try {
      await toggleDiscountActive(discount.id, !discount.isActive);
      loadDiscounts();
    } catch (err) {
      setListError(extractErrorMessage(err, 'Could not toggle discount status.'));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setListError(null);
    try {
      await deleteDiscount(id);
      loadDiscounts();
    } catch (err) {
      setListError(extractErrorMessage(err, 'Could not delete discount.'));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Discounts"
        description="Group discounts applied automatically during pricing based on group size and validity."
      />

      <Card className="mb-8 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-h4 text-fg">{editingId ? 'Edit discount' : 'Add a discount'}</h3>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              Cancel Edit
            </Button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="discount-description"
              label="Description"
              required
              maxLength={200}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <Input
              id="discount-percentage"
              label="Percentage off"
              required
              type="number"
              min={0.01}
              max={100}
              step={0.01}
              value={form.percentageOff}
              onChange={(e) => setForm((f) => ({ ...f, percentageOff: Number(e.target.value) }))}
            />
            <Input
              id="discount-min-group-size"
              label="Minimum group size"
              required
              type="number"
              min={1}
              step={1}
              value={form.minGroupSize}
              onChange={(e) => setForm((f) => ({ ...f, minGroupSize: Number(e.target.value) }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              id="discount-valid-from"
              label="Valid from"
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
            />
            <Input
              id="discount-valid-until"
              label="Valid until"
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
            />
            <div className="flex items-center pt-6">
              <Checkbox
                id="discount-is-active"
                label="Is active"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Discount'}
            </Button>
            {editingId && (
              <Button variant="secondary" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      {listError && (
        <p role="alert" className="mb-4 rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
          {listError}
        </p>
      )}

      {!listError && discounts === null && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14 rounded-card border border-border bg-surface-raised" />
          ))}
        </div>
      )}

      {!listError && discounts !== null && discounts.length === 0 && (
        <Card padded={false} className="border-dashed">
          <EmptyState title="No discounts yet." />
        </Card>
      )}

      {discounts && discounts.length > 0 && (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border bg-surface-sunken text-left text-caption font-semibold uppercase tracking-wide text-fg-muted">
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Percentage off</th>
                <th className="px-4 py-3">Minimum group size</th>
                <th className="px-4 py-3">Validity</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {discounts.map((discount) => {
                const status = getDerivedStatus(discount);
                return (
                  <tr key={discount.id} className="transition hover:bg-surface-sunken">
                    <td className="px-4 py-3 font-medium text-fg">{discount.description}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONES[status]}>{status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{discount.percentageOff}%</td>
                    <td className="px-4 py-3 text-fg-muted">{discount.minGroupSize}+</td>
                    <td className="px-4 py-3 text-fg-muted">
                      {formatValidity(discount.validFrom, discount.validUntil)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => startEdit(discount)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={togglingId === discount.id}
                          onClick={() => handleToggleActive(discount)}
                          className={discount.isActive ? 'border-warning/30 text-warning-fg' : 'border-success/30 text-success-fg'}
                        >
                          {togglingId === discount.id ? 'Updating...' : discount.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="border-danger/30 text-danger-fg"
                          disabled={deletingId === discount.id}
                          onClick={() => handleDelete(discount.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
