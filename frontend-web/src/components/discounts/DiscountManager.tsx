import { useEffect, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  createDiscount,
  deleteDiscount,
  getDiscounts,
  type CreateDiscountRequest,
  type DiscountDto,
} from '../../api/discounts';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const labelClass = 'text-xs font-semibold text-slate-600';

function emptyForm(): CreateDiscountRequest {
  return { description: '', percentageOff: 0, minGroupSize: 1 };
}

export function DiscountManager() {
  const [discounts, setDiscounts] = useState<DiscountDto[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateDiscountRequest>(emptyForm());
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createDiscount(createForm);
      setCreateForm(emptyForm());
      loadDiscounts();
    } catch (err) {
      setCreateError(extractErrorMessage(err, 'Could not create discount.'));
    } finally {
      setCreating(false);
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
      <div className="mb-6">
        <h2 className="font-heading text-xl font-bold text-slate-900">Discounts</h2>
        <p className="mt-1 text-sm text-slate-500">
          Group discounts applied automatically during pricing based on group size.
        </p>
      </div>

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-heading text-base font-bold text-slate-900">Add a discount</h3>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
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
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
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
                value={createForm.percentageOff}
                onChange={(e) => setCreateForm((f) => ({ ...f, percentageOff: Number(e.target.value) }))}
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
                value={createForm.minGroupSize}
                onChange={(e) => setCreateForm((f) => ({ ...f, minGroupSize: Number(e.target.value) }))}
              />
            </div>
          </div>

          {createError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {createError}
            </p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            Add Discount
          </button>
        </form>
      </section>

      {listError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {listError}
        </p>
      )}

      {!listError && discounts === null && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      )}

      {!listError && discounts !== null && discounts.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-600">No discounts yet.</p>
        </div>
      )}

      {discounts && discounts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Percentage off</th>
                <th className="px-4 py-3">Minimum group size</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {discounts.map((discount) => (
                <tr key={discount.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{discount.description}</td>
                  <td className="px-4 py-3 text-slate-600">{discount.percentageOff}%</td>
                  <td className="px-4 py-3 text-slate-600">{discount.minGroupSize}+</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={deletingId === discount.id}
                      onClick={() => handleDelete(discount.id)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
