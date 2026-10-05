import { useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { getMyDriverAssignments, type VehicleAssignmentDetailDto } from '../../api/vehicles';
import { useAuth } from '../../auth/AuthContext';
import { TruckIcon, CalendarIcon, PhoneIcon } from '../../components/admin/icons';
import { VehicleTypeBadge } from '../../components/fleet/fleetBadges';
import { Badge, Button, Card, EmptyState, Skeleton, Tabs, buttonClasses } from '../../components/ui';

export function DriverDashboardPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<VehicleAssignmentDetailDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function load() {
    setLoading(true);
    getMyDriverAssignments()
      .then((data) => {
        setAssignments(data);
        setError(null);
      })
      .catch((err) => setError(extractErrorMessage(err, 'Could not load your driving tasks.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const upcomingTasks = assignments?.filter((a) => a.endDate >= todayStr && a.bookingStatus !== 'Cancelled') ?? [];
  const pastTasks = assignments?.filter((a) => a.endDate < todayStr || a.bookingStatus === 'Cancelled') ?? [];

  const displayedTasks =
    filter === 'upcoming'
      ? upcomingTasks
      : filter === 'past'
        ? pastTasks
        : (assignments ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-h2 text-fg">Welcome back, {user?.name?.split(' ')[0] || 'Driver'}!</h2>
            <p className="mt-1 text-body text-fg-muted">
              View your vehicle assignments, tour schedules, and traveler contact details.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-card border border-info/30 bg-info-soft px-4 py-2.5 text-center">
              <span className="font-heading text-h3 text-info-fg">{upcomingTasks.length}</span>
              <span className="block text-caption font-medium text-info-fg">Active / Upcoming</span>
            </div>
            <div className="rounded-card border border-border bg-surface-sunken px-4 py-2.5 text-center">
              <span className="font-heading text-h3 text-fg">{pastTasks.length}</span>
              <span className="block text-caption font-medium text-fg-muted">Past / Other</span>
            </div>
          </div>
        </div>

        <Tabs
          className="mt-6"
          value={filter}
          onChange={(id) => setFilter(id as typeof filter)}
          items={[
            { id: 'upcoming', label: `Upcoming Tours (${upcomingTasks.length})` },
            { id: 'past', label: `Past / Completed (${pastTasks.length})` },
            { id: 'all', label: `All Assignments (${assignments?.length ?? 0})` },
          ]}
        />
      </Card>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-danger/30 bg-danger-soft p-4 text-danger-fg">
          <div>
            <p className="text-body font-semibold">Error Loading Driver Tasks</p>
            <p className="mt-0.5 text-caption">{error}</p>
          </div>
          <Button variant="danger" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-card border border-border bg-surface-raised" />
          ))}
        </div>
      )}

      {!loading && !error && displayedTasks.length === 0 && (
        <Card padded={false} className="border-dashed">
          <EmptyState
            icon={<TruckIcon className="h-8 w-8" />}
            title="No active driving assignments"
            description={`You do not have any ${filter === 'upcoming' ? 'upcoming' : ''} tour vehicle assignments scheduled right now.`}
            action={<Button onClick={load}>Refresh Tasks</Button>}
          />
        </Card>
      )}

      {!loading && !error && displayedTasks.length > 0 && (
        <div className="space-y-4">
          {displayedTasks.map((task) => {
            const isPast = task.endDate < todayStr;
            const isCancelled = task.bookingStatus === 'Cancelled';

            return (
              <Card key={task.id} className="p-6 transition hover:border-brand-500/30 hover:shadow-raised">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge tone={isCancelled ? 'danger' : isPast ? 'neutral' : 'success'} className="gap-1.5 px-3 py-1">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isCancelled ? 'bg-danger' : isPast ? 'bg-fg-muted' : 'animate-pulse bg-success'
                          }`}
                          aria-hidden
                        />
                        {isCancelled ? 'Cancelled Tour' : isPast ? 'Tour Completed' : 'Active Tour Task'}
                      </Badge>

                      {task.vehicleType && <VehicleTypeBadge type={task.vehicleType} />}

                      <Badge tone={task.hasAC ? 'info' : 'warning'}>
                        {task.hasAC ? 'Air Conditioned (AC)' : 'Non-AC'}
                      </Badge>
                    </div>

                    <div className="mt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-h3 text-fg">{task.packageName || 'Expedition Tour Package'}</span>
                        {task.packageTier && <Badge tone="info">{task.packageTier}</Badge>}
                      </div>
                      {task.itineraryHighlights && task.itineraryHighlights.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {task.itineraryHighlights.map((hl, idx) => (
                            <span
                              key={idx}
                              className="rounded-input border border-border bg-surface-sunken px-2 py-0.5 text-caption text-fg-muted"
                            >
                              &bull; {hl}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-body font-medium text-fg">
                      <CalendarIcon className="h-4 w-4 text-fg-muted" />
                      <span>
                        {task.startDate} &mdash; {task.endDate}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-caption text-fg-muted">Booking Ref: {task.bookingId}</p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-overline text-fg-muted">Assigned Vehicle</p>
                    <span className="mt-1 inline-block rounded-input bg-brand-950 px-3 py-1 font-mono text-body font-bold tracking-wider text-accent-400 shadow-inner">
                      {task.registrationNumber || 'NO REG'}
                    </span>
                    {task.capacity && <p className="mt-1 text-caption text-fg-muted">Capacity: {task.capacity} Passengers</p>}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
                  <div>
                    <p className="text-overline text-fg-muted">Lead Traveler / Passenger</p>
                    <p className="mt-1 text-body font-bold text-fg">{task.travelerName || 'Guest Traveler'}</p>
                    {task.travelerContact ? (
                      <div className="mt-1 flex items-center gap-2 text-caption font-medium text-fg-muted">
                        <PhoneIcon className="h-3.5 w-3.5" />
                        <span>{task.travelerContact}</span>
                      </div>
                    ) : (
                      <p className="mt-1 text-caption text-fg-muted">Contact number unavailable</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {task.travelerContact && (
                      <a href={`tel:${task.travelerContact}`} className={buttonClasses('secondary', 'sm')}>
                        <PhoneIcon className="h-3.5 w-3.5 text-brand-text" />
                        Call Traveler
                      </a>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => toggleExpand(task.id)}>
                      {expandedTasks.has(task.id) ? 'Less Info ▲' : 'More Info ▼'}
                    </Button>
                  </div>
                </div>

                {expandedTasks.has(task.id) && (
                  <div className="mt-4 space-y-3 rounded-card border border-border bg-surface-sunken p-4 text-caption">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      <div>
                        <span className="block text-overline text-fg-muted">Assigned Tour Guide</span>
                        <span className="font-bold text-fg">
                          {task.guideName ? `${task.guideName} (${task.guideContact || 'No phone'})` : 'Independent Driver Tour'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-overline text-fg-muted">Party / Group Size</span>
                        <span className="font-bold text-fg">
                          {task.groupSize ? `${task.groupSize} Guests` : 'Standard Booking'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-overline text-fg-muted">Language Preference</span>
                        <span className="font-bold text-fg">{task.languagePreference || 'English'}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="block text-overline text-fg-muted">Special Requests / Client Notes</span>
                        <span className="font-medium text-fg">{task.specialRequests || 'None specified'}</span>
                      </div>
                    </div>

                    {task.itineraryHighlights && task.itineraryHighlights.length > 0 && (
                      <div className="border-t border-border pt-2">
                        <span className="mb-1 block font-semibold text-fg-muted">Tour Itinerary Timeline:</span>
                        <ul className="list-inside list-disc space-y-1 text-fg-muted">
                          {task.itineraryHighlights.map((hl, i) => (
                            <li key={i}>{hl}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
