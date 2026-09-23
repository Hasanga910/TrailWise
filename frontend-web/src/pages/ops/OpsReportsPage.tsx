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
  const [exportError, setExportError] = useState<string | null>(null);

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
    setExportError(null);
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
      setExportError(extractErrorMessage(err, 'Failed to export audit report CSV.'));
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
      {/* A. Page Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Operations Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Monitor revenue, package occupancy, guide utilization, and export audit data.
        </p>
      </div>

      {/* B. Date Filter Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <label htmlFor="fromDate" className="block text-xs font-semibold text-slate-600">
              From date
            </label>
            <input
              id="fromDate"
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="toDate" className="block text-xs font-semibold text-slate-600">
              To date
            </label>
            <input
              id="toDate"
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Refreshing…' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {validationError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {validationError}
          </p>
        )}
      </section>

      {/* Top-level Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-5" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      )}

      {!loading && !error && (
        <>
          {/* C. Revenue Section */}
          <section className="space-y-6">
            <h2 className="font-heading text-lg font-bold text-slate-900">Revenue Overview</h2>

            {/* Total Revenue Stat Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Total Revenue</p>
              <p className="mt-1 font-heading text-3xl font-bold text-slate-900">
                {currencyFormatter.format(revenue?.totalRevenue ?? 0)}
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Revenue by Package */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-heading text-sm font-bold text-slate-900">Revenue by Package</h3>
                {revenue?.byPackage && revenue.byPackage.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    {revenue.byPackage.map((pkg) => {
                      const pct = maxPackageRevenue > 0 ? (pkg.revenue / maxPackageRevenue) * 100 : 0;
                      return (
                        <div key={pkg.tourPackageId}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{pkg.packageName}</span>
                            <span className="font-semibold text-slate-900">
                              {currencyFormatter.format(pkg.revenue)}
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-slate-100">
                            <div
                              className="h-2.5 rounded-full bg-brand-600 transition-all duration-300"
                              style={{ width: `${Math.max(pct, pkg.revenue > 0 ? 3 : 0)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    No package revenue recorded for this period.
                  </div>
                )}
              </div>

              {/* Revenue by Month */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-heading text-sm font-bold text-slate-900">Revenue by Month</h3>
                {revenue?.byMonth && revenue.byMonth.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    {revenue.byMonth.map((m) => {
                      const pct = maxMonthRevenue > 0 ? (m.revenue / maxMonthRevenue) * 100 : 0;
                      return (
                        <div key={m.label}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{m.label}</span>
                            <span className="font-semibold text-slate-900">
                              {currencyFormatter.format(m.revenue)}
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-slate-100">
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
                  <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    No monthly revenue recorded for this period.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* D. Occupancy Section */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-bold text-slate-900">Package Occupancy</h2>
            {occupancy && occupancy.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Package</th>
                        <th className="px-4 py-3 text-right">Max Group</th>
                        <th className="px-4 py-3 text-right">Bookings</th>
                        <th className="px-4 py-3 text-right">Travelers</th>
                        <th className="px-4 py-3 text-right">Avg Group</th>
                        <th className="px-4 py-3">Occupancy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {occupancy.map((row) => {
                        const cappedPct = Math.min(100, Math.max(0, row.occupancyPercentage));
                        return (
                          <tr key={row.tourPackageId} className="transition hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{row.packageName}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{row.maxGroupSize}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{row.bookingCount}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{row.bookedTravelers}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{row.averageGroupSize.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="w-14 text-sm font-semibold text-slate-900">
                                  {row.occupancyPercentage.toFixed(2)}%
                                </span>
                                <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-brand-600 transition-all duration-300"
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
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <p className="font-medium text-slate-600">No package occupancy records found for this date range.</p>
              </div>
            )}
          </section>

          {/* E. Guide Utilization Section */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-bold text-slate-900">Guide Utilization</h2>
            {guides && guides.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Guide</th>
                        <th className="px-4 py-3 text-right">Assigned Days</th>
                        <th className="px-4 py-3 text-right">Available Days</th>
                        <th className="px-4 py-3 text-right">Recorded Days</th>
                        <th className="px-4 py-3">Utilization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {guides.map((g) => {
                        const cappedPct = Math.min(100, Math.max(0, g.utilizationPercentage));
                        return (
                          <tr key={g.guideId} className="transition hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{g.guideName}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{g.assignedDays}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{g.availableDays}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{g.recordedDays}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="w-14 text-sm font-semibold text-slate-900">
                                  {g.utilizationPercentage.toFixed(2)}%
                                </span>
                                <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-brand-600 transition-all duration-300"
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
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <p className="font-medium text-slate-600">
                  No guide availability records are available for this date range.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Guide schedules will appear once reservations and availability slots are booked.
                </p>
              </div>
            )}
          </section>

          {/* F. Audit CSV Export */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-heading text-lg font-bold text-slate-900">Audit Trail Export</h2>
            <p className="mt-1 text-sm text-slate-500">
              Download the complete system audit log in CSV format for compliance and reporting.
            </p>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="sm:w-64">
                <label htmlFor="exportEntityType" className="block text-xs font-semibold text-slate-600">
                  Entity type
                </label>
                <select
                  id="exportEntityType"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={exportEntityType}
                  onChange={(e) => setExportEntityType(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="Payment">Payment</option>
                  <option value="Review">Review</option>
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exporting}
                  className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {exporting ? 'Exporting…' : 'Export Audit CSV'}
                </button>
              </div>
            </div>

            {exportError && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {exportError}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
