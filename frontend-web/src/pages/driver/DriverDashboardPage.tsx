import { useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/apiClient';
import { getMyDriverAssignments, type VehicleAssignmentDetailDto } from '../../api/vehicles';
import { useAuth } from '../../auth/AuthContext';
import { TruckIcon, CalendarIcon, PhoneIcon } from '../../components/admin/icons';
import { VehicleTypeBadge } from '../../components/fleet/FleetManager';

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
        {/* Welcome & Metrics */}
        <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold text-fg">
                Welcome back, {user?.name?.split(' ')[0] || 'Driver'}!
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                View your vehicle assignments, tour schedules, and traveler contact details.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-info/30 bg-info-soft/70 px-4 py-2.5 text-center">
                <span className="text-xl font-bold text-info-fg">{upcomingTasks.length}</span>
                <span className="block text-xs font-medium text-info">Active / Upcoming</span>
              </div>
              <div className="rounded-xl border border-border bg-surface-sunken px-4 py-2.5 text-center">
                <span className="text-xl font-bold text-fg">{pastTasks.length}</span>
                <span className="block text-xs font-medium text-fg-muted">Past / Other</span>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-6 flex border-b border-border gap-4">
            <button
              onClick={() => setFilter('upcoming')}
              className={`pb-3 text-sm font-semibold transition border-b-2 ${
                filter === 'upcoming'
                  ? 'border-info text-info-fg'
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`}
            >
              Upcoming Tours ({upcomingTasks.length})
            </button>
            <button
              onClick={() => setFilter('past')}
              className={`pb-3 text-sm font-semibold transition border-b-2 ${
                filter === 'past'
                  ? 'border-info text-info-fg'
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`}
            >
              Past / Completed ({pastTasks.length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`pb-3 text-sm font-semibold transition border-b-2 ${
                filter === 'all'
                  ? 'border-info text-info-fg'
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`}
            >
              All Assignments ({assignments?.length ?? 0})
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-danger-fg flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Error Loading Driver Tasks</p>
              <p className="mt-0.5 text-xs">{error}</p>
            </div>
            <button
              onClick={load}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border border-border bg-surface-raised p-6" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && displayedTasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-info-soft text-info">
              <TruckIcon className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-heading text-lg font-bold text-fg">
              No active driving assignments
            </h3>
            <p className="mt-1 text-sm text-fg-muted max-w-sm mx-auto">
              You do not have any {filter === 'upcoming' ? 'upcoming' : ''} tour vehicle assignments scheduled right now.
            </p>
            <button
              onClick={load}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2 text-sm font-medium text-surface shadow hover:bg-fg/90"
            >
              Refresh Tasks
            </button>
          </div>
        )}

        {/* Task Cards */}
        {!loading && !error && displayedTasks.length > 0 && (
          <div className="space-y-4">
            {displayedTasks.map((task) => {
              const isPast = task.endDate < todayStr;
              const isCancelled = task.bookingStatus === 'Cancelled';

              return (
                <div
                  key={task.id}
                  className="rounded-2xl border border-border bg-surface-raised p-6 shadow-sm transition hover:border-info/30 hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    {/* Dates & Status */}
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            isCancelled
                              ? 'bg-danger-soft text-danger-fg border border-danger/30'
                              : isPast
                                ? 'bg-neutral-soft text-fg-muted border border-border'
                                : 'bg-success-soft text-success-fg border border-success/30'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isCancelled ? 'bg-red-500' : isPast ? 'bg-fg-muted' : 'bg-emerald-500 animate-pulse'
                            }`}
                          />
                          {isCancelled ? 'Cancelled Tour' : isPast ? 'Tour Completed' : 'Active Tour Task'}
                        </span>

                        {task.vehicleType && <VehicleTypeBadge type={task.vehicleType} />}

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            task.hasAC ? 'bg-info-soft text-info-fg' : 'bg-warning-soft text-warning-fg'
                          }`}
                        >
                          {task.hasAC ? 'Air Conditioned (AC)' : 'Non-AC'}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-lg font-bold text-fg">
                            {task.packageName || 'Expedition Tour Package'}
                          </span>
                          {task.packageTier && (
                            <span className="rounded-md bg-info-soft px-2 py-0.5 text-xs font-semibold text-info-fg">
                              {task.packageTier}
                            </span>
                          )}
                        </div>
                        {task.itineraryHighlights && task.itineraryHighlights.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {task.itineraryHighlights.map((hl, idx) => (
                              <span
                                key={idx}
                                className="rounded-md border border-border bg-surface-sunken px-2 py-0.5 text-xs text-fg-muted"
                              >
                                &bull; {hl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-fg font-medium text-sm">
                        <CalendarIcon className="h-4 w-4 text-fg-muted" />
                        <span>
                          {task.startDate} &mdash; {task.endDate}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-fg-muted font-mono">
                        Booking Ref: {task.bookingId}
                      </p>
                    </div>

                    {/* Registration Tag */}
                    <div className="sm:text-right">
                      <p className="text-xs uppercase font-semibold text-fg-muted tracking-wider">
                        Assigned Vehicle
                      </p>
                      <span className="mt-1 inline-block rounded-lg bg-brand-950 px-3 py-1 font-mono text-sm font-bold tracking-wider text-accent-400 shadow-inner">
                        {task.registrationNumber || 'NO REG'}
                      </span>
                      {task.capacity && (
                        <p className="mt-1 text-xs text-fg-muted">
                          Capacity: {task.capacity} Passengers
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Passenger / Traveler Information */}
                  <div className="mt-5 border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-fg-muted uppercase tracking-wider">
                        Lead Traveler / Passenger
                      </p>
                      <p className="mt-1 text-sm font-bold text-fg">
                        {task.travelerName || 'Guest Traveler'}
                      </p>
                      {task.travelerContact ? (
                        <div className="mt-1 flex items-center gap-2 text-xs font-medium text-fg-muted">
                          <PhoneIcon className="h-3.5 w-3.5 text-fg-muted" />
                          <span>{task.travelerContact}</span>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-fg-muted">Contact number unavailable</p>
                      )}
                    </div>

                    <div className="flex sm:justify-end items-center gap-2">
                      {task.travelerContact && (
                        <a
                          href={`tel:${task.travelerContact}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3.5 py-2 text-xs font-semibold text-fg shadow-xs transition hover:bg-surface-sunken hover:text-fg"
                        >
                          <PhoneIcon className="h-3.5 w-3.5 text-info" />
                          Call Traveler
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleExpand(task.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-info/30 bg-info-soft/70 px-3.5 py-2 text-xs font-semibold text-info-fg hover:bg-info-soft transition"
                      >
                        {expandedTasks.has(task.id) ? 'Less Info ▲' : 'More Info ▼'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Full Booking Details Section */}
                  {expandedTasks.has(task.id) && (
                    <div className="mt-4 rounded-xl border border-border bg-surface-sunken/70 p-4 text-xs space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <span className="font-semibold text-fg-muted uppercase tracking-wider block text-[10px]">
                            Assigned Tour Guide
                          </span>
                          <span className="font-bold text-fg">
                            {task.guideName ? `${task.guideName} (${task.guideContact || 'No phone'})` : 'Independent Driver Tour'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-fg-muted uppercase tracking-wider block text-[10px]">
                            Party / Group Size
                          </span>
                          <span className="font-bold text-fg">
                            {task.groupSize ? `${task.groupSize} Guests` : 'Standard Booking'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-fg-muted uppercase tracking-wider block text-[10px]">
                            Language Preference
                          </span>
                          <span className="font-bold text-fg">
                            {task.languagePreference || 'English'}
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="font-semibold text-fg-muted uppercase tracking-wider block text-[10px]">
                            Special Requests / Client Notes
                          </span>
                          <span className="font-medium text-fg">
                            {task.specialRequests || 'None specified'}
                          </span>
                        </div>
                      </div>

                      {task.itineraryHighlights && task.itineraryHighlights.length > 0 && (
                        <div className="pt-2 border-t border-border">
                          <span className="font-semibold text-fg-muted block mb-1">
                            Tour Itinerary Timeline:
                          </span>
                          <ul className="space-y-1 text-fg-muted list-disc list-inside">
                            {task.itineraryHighlights.map((hl, i) => (
                              <li key={i}>{hl}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}
