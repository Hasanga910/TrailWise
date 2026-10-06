import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { extractErrorMessage, extractFieldErrors } from '../../api/apiClient';
import { createBooking } from '../../api/bookings';
import { getPackages, type TourPackage } from '../../api/packages';
import { Button, Card, Input, PageHeader, Select, Textarea } from '../../components/ui';
import { notify } from '../../components/ui/notify';

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

function parsePositiveInt(value: string | null): number | null {
  const n = value ? Number.parseInt(value, 10) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 1000 ? n : null;
}

function parseIsoDate(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}

export function BookingRequestPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [packages, setPackages] = useState<TourPackage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [packageTierId, setPackageTierId] = useState(searchParams.get('tier') ?? '');
  // Optional prefill from the public explorer: ?guests=4&start=2026-11-02
  const [groupSize, setGroupSize] = useState(() => parsePositiveInt(searchParams.get('guests')) ?? 1);
  const [startDate, setStartDate] = useState(() => parseIsoDate(searchParams.get('start')) ?? '');
  const [endDate, setEndDate] = useState('');
  const [budgetPerPerson, setBudgetPerPerson] = useState(0);
  const [specialRequests, setSpecialRequests] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
        notify.error(extractErrorMessage(err, 'Could not submit booking request.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Request a Booking"
        description="Choose a package tier, your dates, group size, and budget per person."
      />

      {loadError && (
        <p role="alert" className="mb-4 rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
          {loadError}
        </p>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            id="packageTierId"
            label="Package tier"
            required
            value={packageTierId}
            error={fieldErrors.packageTierId}
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
          </Select>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="startDate"
              label="Start date"
              required
              type="date"
              value={startDate}
              error={fieldErrors.startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              id="endDate"
              label="End date"
              required
              type="date"
              value={endDate}
              error={fieldErrors.endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <Input
              id="groupSize"
              label="Group size"
              required
              type="number"
              min={1}
              value={groupSize}
              error={fieldErrors.groupSize}
              onChange={(e) => setGroupSize(Number(e.target.value))}
            />
            <Input
              id="budgetPerPerson"
              label="Budget per person"
              required
              type="number"
              min={0.01}
              step="0.01"
              value={budgetPerPerson}
              error={fieldErrors.budgetPerPerson}
              onChange={(e) => setBudgetPerPerson(Number(e.target.value))}
            />
          </div>

          <Textarea
            id="specialRequests"
            label="Special requests (optional)"
            rows={3}
            maxLength={1000}
            value={specialRequests}
            hint="This note is processed by an AI service to help plan your trip. Avoid including sensitive personal or payment details."
            error={fieldErrors.specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
          />

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit request'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
