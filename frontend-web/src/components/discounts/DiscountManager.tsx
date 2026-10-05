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

const inputClass =
  'w-full rounded-lg border border-border px-3 py-2 text-sm text-fg focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const labelClass = 'text-xs font-semibold text-fg-muted';

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

  function renderStatusBadge(status: DerivedStatus) {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-fg">
            Active
          </span>
        );
      case 'Upcoming':
        return (
          <span className="inline-flex items-center rounded-full border border-info/30 bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info-fg">
            Upcoming
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-fg">
            Expired
          </span>
        );
      case 'Inactive':
        return (
          <span className="inline-flex items-center rounded-full border border-border bg-neutral-soft px-2.5 py-0.5 text-xs font-semibold text-fg">
            Inactive
          </span>
        );
    }
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="font-heading text-xl font-bold text-fg">Discounts</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Group discounts applied automatically during pricing based on group size and validity.
        </p>
      </div>

      <section className="mb-8 rounded-xl border border-border bg-surface-raised p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-bold text-fg">
            {editingId ? 'Edit discount' : 'Add a discount'}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs font-semibold text-fg-muted hover:text-fg"
            >
              Cancel Edit
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label htmlFor="discount-description" className={labelClass}>
                Description
              </label>
              <input
                id="discount-description"
                required
                maxLength={200}
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="discount-percentage" className={labelClass}>
                Percentage off
              </label>
              <input
                id="discount-percentage"
                required
                type="number"
                min={0.01}
                max={100}
                step={0.01}
                className={inputClass}
                value={form.percentageOff}
                onChange={(e) => setForm((f) => ({ ...f, percentageOff: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label htmlFor="discount-min-group-size" className={labelClass}>
                Minimum group size
              </label>
              <input
                id="discount-min-group-size"
                required
                type="number"
                min={1}
                step={1}
                className={inputClass}
                value={form.minGroupSize}
                onChange={(e) => setForm((f) => ({ ...f, minGroupSize: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="discount-valid-from" className={labelClass}>
                Valid from
              </label>
              <input
                id="discount-valid-from"
                type="datetime-local"
                className={inputClass}
                value={form.validFrom}
                onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="discount-valid-until" className={labelClass}>
                Valid until
              </label>
              <input
                id="discount-valid-until"
                type="datetime-local"
                className={inputClass}
                value={form.validUntil}
                onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex cursor-pointer items-center space-x-2">
                <input
                  id="discount-is-active"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-brand-text focus:ring-brand-500"
                />
                <span className="text-sm font-semibold text-fg">Is active</span>
              </label>
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-fg">
              {formError}
            </p>
          )}

          <div className="flex items-center space-x-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Discount'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg transition hover:bg-surface-sunken"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {listError && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-fg">
          {listError}
        </p>
      )}

      {!listError && discounts === null && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-surface-raised" />
          ))}
        </div>
      )}

      {!listError && discounts !== null && discounts.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
          <p className="font-medium text-fg-muted">No discounts yet.</p>
        </div>
      )}

      {discounts && discounts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-raised shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">
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
                    <td className="px-4 py-3">{renderStatusBadge(status)}</td>
                    <td className="px-4 py-3 text-fg-muted">{discount.percentageOff}%</td>
                    <td className="px-4 py-3 text-fg-muted">{discount.minGroupSize}+</td>
                    <td className="px-4 py-3 text-fg-muted">
                      {formatValidity(discount.validFrom, discount.validUntil)}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => startEdit(discount)}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-fg transition hover:bg-neutral-soft"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={togglingId === discount.id}
                        onClick={() => handleToggleActive(discount)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                          discount.isActive
                            ? 'border-warning/30 text-warning-fg hover:bg-warning-soft'
                            : 'border-success/30 text-success-fg hover:bg-success-soft'
                        }`}
                      >
                        {togglingId === discount.id
                          ? 'Updating...'
                          : discount.isActive
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === discount.id}
                        onClick={() => handleDelete(discount.id)}
                        className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs font-semibold text-danger-fg transition hover:bg-danger-soft disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
