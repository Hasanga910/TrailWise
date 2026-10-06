import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, RefreshCw, Workflow } from 'lucide-react';
import { extractErrorMessage } from '../../api/apiClient';
import { APPROVAL_TYPE_LABELS, type ApprovalType } from '../../api/approvals';
import { getOpsDashboard, type OpsDashboardDto } from '../../api/reports';
import { useAuth } from '../../auth/AuthContext';
import { startsInText } from '../../components/ops/dashboard/dashboardFormat';
import { UrgentRefunds } from '../../components/ops/dashboard/UrgentRefunds';
import { UtilizationBar } from '../../components/ops/dashboard/UtilizationBar';
import { Badge, Button, Card, CardHeader, CardTitle, EmptyState, PageHeader, Skeleton, StatCard } from '../../components/ui';
import { formatDate, pluralize } from '../../utils/format';

const TYPE_COUNT_KEY: Record<ApprovalType, 'largeGroupOrCustomItinerary' | 'budgetOverride' | 'refundException'> = {
  LargeGroupOrCustomItinerary: 'largeGroupOrCustomItinerary',
  BudgetOverride: 'budgetOverride',
  RefundException: 'refundException',
};

function windowText(from: string, to: string) {
  return `${formatDate(from)} to ${formatDate(to)}`;
}

/** Operations dashboard (design doc section 6): upcoming tours, pending approvals, guide and vehicle utilisation. */
export function OpsDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<OpsDashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getOpsDashboard());
      setError(null);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load the dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getOpsDashboard()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, 'Could not load the dashboard.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const urgent = data?.approvals.refundExceptions.filter((r) => r.urgent) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Operations dashboard"
        description={`Welcome back, ${user?.name ?? ''}. Here is what needs attention.`}
        actions={
          <Button variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />} onClick={() => void load()} loading={loading && data !== null}>
            Refresh
          </Button>
        }
      />

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-body text-danger-fg">
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={() => void load()}>Retry</Button>
        </div>
      )}

      {!data && loading && (
        <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {data && (
        <>
          <UrgentRefunds items={urgent} withinDays={data.approvals.urgentWithinDays} />

          <section aria-label="Pending approvals" className="space-y-3">
            <h3 className="flex items-center gap-2 font-heading text-h4 text-fg">
              <ClipboardCheck className="h-5 w-5 text-brand-fg" aria-hidden />
              Pending approvals
              <Link to="/ops/approvals" className="ml-auto text-body font-medium text-brand-fg hover:underline">
                Open the queue
              </Link>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link to="/ops/approvals" aria-label={`All pending approvals: ${data.approvals.counts.total}`} className="rounded-card focus-visible:outline-2">
                <StatCard label="All pending" value={data.approvals.counts.total} hint={data.approvals.urgentCount > 0 ? `${data.approvals.urgentCount} urgent` : 'none urgent'} />
              </Link>
              {(Object.keys(TYPE_COUNT_KEY) as ApprovalType[]).map((type) => (
                <Link
                  key={type}
                  to={`/ops/approvals?type=${type}`}
                  aria-label={`${APPROVAL_TYPE_LABELS[type]}: ${data.approvals.counts[TYPE_COUNT_KEY[type]]}`}
                  className="rounded-card focus-visible:outline-2"
                >
                  <StatCard label={APPROVAL_TYPE_LABELS[type]} value={data.approvals.counts[TYPE_COUNT_KEY[type]]} />
                </Link>
              ))}
            </div>
          </section>

          <section aria-label="Workflow health" className="space-y-3">
            <h3 className="flex items-center gap-2 font-heading text-h4 text-fg">
              <Workflow className="h-5 w-5 text-brand-fg" aria-hidden />
              Agent workflows
              <Link to="/ops/workflows" className="ml-auto text-body font-medium text-brand-fg hover:underline">
                Open the monitor
              </Link>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Running" value={data.workflows.running} />
              <StatCard label="Awaiting approval" value={data.workflows.awaitingApproval} />
              <StatCard label="Failed runs" value={data.workflows.failed} />
              <StatCard label="Needs manual review" value={data.workflows.bookingsNeedingManualReview} hint="bookings" />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card aria-label="Upcoming tours" role="region">
              <CardHeader>
                <CardTitle>Upcoming tours</CardTitle>
              </CardHeader>
              {data.upcomingTours.length === 0 ? (
                <EmptyState title="No upcoming tours" description="Confirmed tours that have not started yet appear here." />
              ) : (
                <ul className="divide-y divide-border">
                  {data.upcomingTours.map((tour) => (
                    <li key={tour.bookingId} className="flex flex-wrap items-start justify-between gap-2 py-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-fg">{tour.tourPackageName}</span>
                        <span className="block text-caption text-fg-muted">
                          {tour.travelerName} · {pluralize(tour.groupSize, 'traveler')}
                        </span>
                        <span className="block text-caption text-fg-muted">
                          Guide: {tour.guideName ?? 'not assigned'} · Vehicle: {tour.vehicleRegistration ?? 'not assigned'}
                          {tour.driverName ? ` (${tour.driverName})` : ''}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-body font-medium text-fg">{formatDate(tour.startDate)}</span>
                        <Badge tone={tour.daysUntilStart <= 2 ? 'warning' : 'neutral'}>{startsInText(tour.daysUntilStart)}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="space-y-6">
              <Card role="region" aria-label="Guide utilisation">
                <CardHeader>
                  <CardTitle>Guide utilisation</CardTitle>
                  <span className="text-caption text-fg-muted">{windowText(data.guideUtilization.window.from, data.guideUtilization.window.to)}</span>
                </CardHeader>
                <p className="mb-3 font-heading text-h2 text-fg">
                  {Math.round(data.guideUtilization.overallPercentage)}% <span className="text-body font-normal text-fg-muted">of guide days assigned</span>
                </p>
                {data.guideUtilization.guides.length === 0 ? (
                  <p className="text-body text-fg-muted">No guides yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.guideUtilization.guides.map((g) => (
                      <UtilizationBar
                        key={g.guideId}
                        label={g.guideName}
                        percentage={g.utilizationPercentage}
                        detail={`${g.assignedDays} of ${g.windowDays} days`}
                      />
                    ))}
                  </ul>
                )}
              </Card>

              <Card role="region" aria-label="Vehicle utilisation">
                <CardHeader>
                  <CardTitle>Vehicle utilisation</CardTitle>
                  <span className="text-caption text-fg-muted">{windowText(data.vehicleUtilization.window.from, data.vehicleUtilization.window.to)}</span>
                </CardHeader>
                <p className="mb-3 font-heading text-h2 text-fg">
                  {Math.round(data.vehicleUtilization.overallPercentage)}%{' '}
                  <span className="text-body font-normal text-fg-muted">
                    of {pluralize(data.vehicleUtilization.inServiceVehicles, 'vehicle')} in service booked
                  </span>
                </p>
                {data.vehicleUtilization.vehicles.length === 0 ? (
                  <p className="text-body text-fg-muted">No vehicles yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.vehicleUtilization.vehicles.map((v) => (
                      <UtilizationBar
                        key={v.vehicleId}
                        label={`${v.registrationNumber} (${v.type})${v.maintenanceStatus === 'Available' ? '' : `, ${v.maintenanceStatus}`}`}
                        percentage={v.utilizationPercentage}
                        detail={`${v.bookedDays} of ${data.vehicleUtilization.window.days} days`}
                        muted={v.maintenanceStatus === 'OutOfService'}
                      />
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
