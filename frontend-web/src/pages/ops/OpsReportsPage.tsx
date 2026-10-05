import { useCallback, useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import {
  exportAuditLogsCsv,
  getGuideUtilizationReport,
  getOccupancyReport,
  getRevenueReport,
  type GuideUtilizationDto,
  type PackageOccupancyDto,
  type RevenueReportResponse,
} from '../../api/reports';
import { Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from '../../components/ui';
import { notify } from '../../components/ui/notify';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

function getInitialDates() {
  const today = new Date();
  const past = new Date();
  past.setDate(today.getDate() - 30);
  return {
    from: past.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

export function OpsReportsPage() {
  const initialDates = getInitialDates();
  const [from, setFrom] = useState(initialDates.from);
  const [to, setTo] = useState(initialDates.to);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [revenue, setRevenue] = useState<RevenueReportResponse | null>(null);
  const [occupancy, setOccupancy] = useState<PackageOccupancyDto[] | null>(null);
  const [guides, setGuides] = useState<GuideUtilizationDto[] | null>(null);

  const [exportEntityType, setExportEntityType] = useState<string>('All');
  const [exporting, setExporting] = useState(false);

  const loadReports = useCallback(async (fromDate: string, toDate: string) => {
    if (!fromDate || !toDate) {
      setValidationError("Both 'From' and 'To' dates are required.");
      return;
    }
    if (fromDate > toDate) {
      setValidationError("'From' date must not be after 'To' date.");
      return;
    }

    setValidationError(null);
    setError(null);
    setLoading(true);

    try {
      const [revData, occData, guideData] = await Promise.all([
        getRevenueReport(fromDate, toDate),
        getOccupancyReport(fromDate, toDate),
        getGuideUtilizationReport(fromDate, toDate),
      ]);

      setRevenue(revData);
      setOccupancy(occData);
      setGuides(guideData);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load operations reports.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports(from, to);
  }, [loadReports]);

  function handleRefresh() {
    loadReports(from, to);
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const blob = await exportAuditLogsCsv(
        from || undefined,
        to || undefined,
        exportEntityType === 'All' ? undefined : exportEntityType,
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'trailwise-audit-report.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      notify.error(extractErrorMessage(err, 'Failed to export audit report CSV.'));
    } finally {
      setExporting(false);
    }
  }

  const maxPackageRevenue = revenue?.byPackage?.length
    ? Math.max(...revenue.byPackage.map((p) => p.revenue), 1)
    : 1;

  const maxMonthRevenue = revenue?.byMonth?.length
    ? Math.max(...revenue.byMonth.map((m) => m.revenue), 1)
    : 1;

  return (
    <div className="space-y-8">
      <PageHeader
        as="h1"
        title="Operations Reports"
        description="Monitor revenue, package occupancy, guide utilization, and export audit data."
        className="mb-0"
      />

      <Card>
        <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <Input id="fromDate" type="date" label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input id="toDate" type="date" label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={handleRefresh} disabled={loading} className="w-full">
            {loading ? 'Refreshing…' : 'Refresh Data'}
          </Button>
        </div>

        {validationError && (
          <p role="alert" className="mt-4 rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
            {validationError}
          </p>
        )}
      </Card>

      {/* Top-level Error State */}
      {error && (
        <div role="alert" className="rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-card border border-border bg-surface-raised" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-card border border-border bg-surface-raised" />
          <Skeleton className="h-48 rounded-card border border-border bg-surface-raised" />
        </div>
      )}

      {!loading && !error && (
        <>
          {/* C. Revenue Section */}
          <section className="space-y-6">
            <h2 className="font-heading text-lg font-bold text-fg">Revenue Overview</h2>

            {/* Total Revenue Stat Card */}
            <Card>
              <p className="text-sm font-medium text-fg-muted">Total Revenue</p>
              <p className="mt-1 font-heading text-3xl font-bold text-fg">
                {currencyFormatter.format(revenue?.totalRevenue ?? 0)}
              </p>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Revenue by Package */}
              <Card>
                <h3 className="font-heading text-sm font-bold text-fg">Revenue by Package</h3>
                {revenue?.byPackage && revenue.byPackage.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    {revenue.byPackage.map((pkg) => {
                      const pct = maxPackageRevenue > 0 ? (pkg.revenue / maxPackageRevenue) * 100 : 0;
                      return (
                        <div key={pkg.tourPackageId}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-fg">{pkg.packageName}</span>
                            <span className="font-semibold text-fg">
                              {currencyFormatter.format(pkg.revenue)}
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-neutral-soft">
                            <div
                              className="h-2.5 rounded-full bg-brand-700 transition-all duration-300"
                              style={{ width: `${Math.max(pct, pkg.revenue > 0 ? 3 : 0)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-fg-muted">
                    No package revenue recorded for this period.
                  </div>
                )}
              </Card>

              {/* Revenue by Month */}
              <Card>
                <h3 className="font-heading text-sm font-bold text-fg">Revenue by Month</h3>
                {revenue?.byMonth && revenue.byMonth.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    {revenue.byMonth.map((m) => {
                      const pct = maxMonthRevenue > 0 ? (m.revenue / maxMonthRevenue) * 100 : 0;
                      return (
                        <div key={m.label}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-fg">{m.label}</span>
                            <span className="font-semibold text-fg">
                              {currencyFormatter.format(m.revenue)}
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-neutral-soft">
                            <div
                              className="h-2.5 rounded-full bg-accent-500 transition-all duration-300"
                              style={{ width: `${Math.max(pct, m.revenue > 0 ? 3 : 0)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-fg-muted">
                    No monthly revenue recorded for this period.
                  </div>
                )}
              </Card>
            </div>
          </section>

          {/* D. Occupancy Section */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-bold text-fg">Package Occupancy</h2>
            {occupancy && occupancy.length > 0 ? (
              <Card padded={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-sunken text-xs font-semibold uppercase tracking-wide text-fg-muted">
                        <th className="px-4 py-3">Package</th>
                        <th className="px-4 py-3 text-right">Max Group</th>
                        <th className="px-4 py-3 text-right">Bookings</th>
                        <th className="px-4 py-3 text-right">Travelers</th>
                        <th className="px-4 py-3 text-right">Avg Group</th>
                        <th className="px-4 py-3">Occupancy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {occupancy.map((row) => {
                        const cappedPct = Math.min(100, Math.max(0, row.occupancyPercentage));
                        return (
                          <tr key={row.tourPackageId} className="transition hover:bg-surface-sunken">
                            <td className="px-4 py-3 font-medium text-fg">{row.packageName}</td>
                            <td className="px-4 py-3 text-right text-fg-muted">{row.maxGroupSize}</td>
                            <td className="px-4 py-3 text-right text-fg-muted">{row.bookingCount}</td>
                            <td className="px-4 py-3 text-right text-fg-muted">{row.bookedTravelers}</td>
                            <td className="px-4 py-3 text-right text-fg-muted">{row.averageGroupSize.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="w-14 text-sm font-semibold text-fg">
                                  {row.occupancyPercentage.toFixed(2)}%
                                </span>
                                <div className="h-2 w-28 overflow-hidden rounded-full bg-neutral-soft">
                                  <div
                                    className="h-full rounded-full bg-brand-700 transition-all duration-300"
                                    style={{ width: `${cappedPct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card padded={false} className="border-dashed">
                <EmptyState title="No package occupancy records found for this date range." />
              </Card>
            )}
          </section>

          {/* E. Guide Utilization Section */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-bold text-fg">Guide Utilization</h2>
            {guides && guides.length > 0 ? (
              <Card padded={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-sunken text-xs font-semibold uppercase tracking-wide text-fg-muted">
                        <th className="px-4 py-3">Guide</th>
                        <th className="px-4 py-3 text-right">Assigned Days</th>
                        <th className="px-4 py-3 text-right">Available Days</th>
                        <th className="px-4 py-3 text-right">Days in Window</th>
                        <th className="px-4 py-3">Utilization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {guides.map((g) => {
                        const cappedPct = Math.min(100, Math.max(0, g.utilizationPercentage));
                        return (
                          <tr key={g.guideId} className="transition hover:bg-surface-sunken">
                            <td className="px-4 py-3 font-medium text-fg">{g.guideName}</td>
                            <td className="px-4 py-3 text-right text-fg-muted">{g.assignedDays}</td>
                            <td className="px-4 py-3 text-right text-fg-muted">{g.availableDays}</td>
                            <td className="px-4 py-3 text-right text-fg-muted">{g.windowDays}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="w-14 text-sm font-semibold text-fg">
                                  {g.utilizationPercentage.toFixed(2)}%
                                </span>
                                <div className="h-2 w-28 overflow-hidden rounded-full bg-neutral-soft">
                                  <div
                                    className="h-full rounded-full bg-brand-700 transition-all duration-300"
                                    style={{ width: `${cappedPct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card padded={false} className="border-dashed">
                <EmptyState
                  title="No guide availability records are available for this date range."
                  description="Guide schedules will appear once reservations and availability slots are booked."
                />
              </Card>
            )}
          </section>

          {/* F. Audit CSV Export */}
          <Card>
            <h2 className="font-heading text-lg font-bold text-fg">Audit Trail Export</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Download the complete system audit log in CSV format for compliance and reporting.
            </p>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
              <Select
                id="exportEntityType"
                label="Entity type"
                wrapperClassName="sm:w-64"
                value={exportEntityType}
                onChange={(e) => setExportEntityType(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Payment">Payment</option>
                <option value="Review">Review</option>
              </Select>

              <Button onClick={handleExportCsv} disabled={exporting}>
                {exporting ? 'Exporting…' : 'Export Audit CSV'}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
