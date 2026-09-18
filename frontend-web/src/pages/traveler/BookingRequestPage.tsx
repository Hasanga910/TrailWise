import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { extractErrorMessage, extractFieldErrors } from '../../api/apiClient';
import { createBooking } from '../../api/bookings';
import { getPackages, type TourPackage } from '../../api/packages';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const labelClass = 'text-xs font-semibold text-slate-600';
const fieldErrorClass = 'mt-1 text-xs font-medium text-red-700';

interface TierOption {
  tierId: string;
  packageId: string;
  packageName: string;
  classType: string;
  basePricePerPerson: number;
}

function flattenTiers(packages: TourPackage[]): TierOption[] {
  return packages.flatMap((pkg) =>
    pkg.tiers.map((tier) => ({
      tierId: tier.id,
      packageId: pkg.id,
      packageName: pkg.name,
      classType: tier.classType,
      basePricePerPerson: tier.basePricePerPerson,
    })),
  );
}

export function BookingRequestPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [packages, setPackages] = useState<TourPackage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [packageTierId, setPackageTierId] = useState(searchParams.get('tier') ?? '');
  const [groupSize, setGroupSize] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetPerPerson, setBudgetPerPerson] = useState(0);
  const [specialRequests, setSpecialRequests] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPackages()
      .then(setPackages)
      .catch((err) => setLoadError(extractErrorMessage(err, 'Could not load tour packages.')));
  }, []);

  const tierOptions = useMemo(() => flattenTiers(packages ?? []), [packages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError(null);

    if (!packageTierId) {
      setFieldErrors({ packageTierId: 'Please select a package tier.' });
      return;
    }

    setSubmitting(true);
    try {
      await createBooking({
        packageTierId,
        groupSize,
        startDate,
        endDate,
        budgetPerPerson,
        specialRequests: specialRequests.trim() || undefined,
      });
      navigate('/traveler/bookings');
    } catch (err) {
      const errors = extractFieldErrors(err);
      setFieldErrors(errors);
      if (Object.keys(errors).length === 0) {
        setSubmitError(extractErrorMessage(err, 'Could not submit booking request.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="font-heading text-xl font-bold text-slate-900">Request a Booking</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose a package tier, your dates, group size, and budget per person.
        </p>
      </div>

      {loadError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {loadError}
        </p>
      )}

      {submitError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {submitError}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="packageTierId" className={labelClass}>
            Package tier
          </label>
          <select
            id="packageTierId"
            required
            className={inputClass}
            value={packageTierId}
            onChange={(e) => setPackageTierId(e.target.value)}
          >
            <option value="" disabled>
              Select a package tier
            </option>
            {tierOptions.map((option) => (
              <option key={option.tierId} value={option.tierId}>
                {option.packageName} — {option.classType} (${option.basePricePerPerson.toFixed(2)}/person)
              </option>
            ))}
          </select>
          {fieldErrors.packageTierId && <p className={fieldErrorClass}>{fieldErrors.packageTierId}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="startDate" className={labelClass}>
              Start date
            </label>
            <input
              id="startDate"
              required
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            {fieldErrors.startDate && <p className={fieldErrorClass}>{fieldErrors.startDate}</p>}
          </div>
          <div>
            <label htmlFor="endDate" className={labelClass}>
              End date
            </label>
            <input
              id="endDate"
              required
              type="date"
              className={inputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {fieldErrors.endDate && <p className={fieldErrorClass}>{fieldErrors.endDate}</p>}
          </div>
          <div>
            <label htmlFor="groupSize" className={labelClass}>
              Group size
            </label>
            <input
              id="groupSize"
              required
              type="number"
              min={1}
              className={inputClass}
              value={groupSize}
              onChange={(e) => setGroupSize(Number(e.target.value))}
            />
            {fieldErrors.groupSize && <p className={fieldErrorClass}>{fieldErrors.groupSize}</p>}
          </div>
          <div>
            <label htmlFor="budgetPerPerson" className={labelClass}>
              Budget per person
            </label>
            <input
              id="budgetPerPerson"
              required
              type="number"
              min={0.01}
              step="0.01"
              className={inputClass}
              value={budgetPerPerson}
              onChange={(e) => setBudgetPerPerson(Number(e.target.value))}
            />
            {fieldErrors.budgetPerPerson && <p className={fieldErrorClass}>{fieldErrors.budgetPerPerson}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="specialRequests" className={labelClass}>
            Special requests (optional)
          </label>
          <textarea
            id="specialRequests"
            rows={3}
            maxLength={1000}
            className={inputClass}
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
          />
          {fieldErrors.specialRequests && <p className={fieldErrorClass}>{fieldErrors.specialRequests}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit request'}
        </button>
      </form>
    </div>
  );
}
