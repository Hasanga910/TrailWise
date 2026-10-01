import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getMyDriverAssignments, type VehicleAssignmentDetailDto } from '../../api/vehicles';
import { useAuth } from '../../auth/AuthContext';
import { Avatar } from '../../components/Avatar';
import { Logo } from '../../components/Logo';
import { LogoutIcon, TruckIcon, CalendarIcon, PhoneIcon } from '../../components/admin/icons';
import { VehicleTypeBadge } from '../../components/fleet/FleetManager';

export function DriverDashboardPage() {
  const { user, logout } = useAuth();
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
    <div className="min-h-svh bg-slate-50">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-blue-600 before:via-sky-500 before:to-blue-600">
        <div className="flex items-center gap-4">
          <Link to="/driver/dashboard" title="Home" className="flex items-center gap-2">
            <Logo className="h-7 w-auto" />
          </Link>
          <span className="hidden text-slate-300 sm:inline">|</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <TruckIcon className="h-4 w-4" />
            </span>
            <h1 className="font-heading text-lg font-bold text-slate-900">Driver Portal</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/driver/profile"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-blue-600 transition"
          >
            Profile & Settings
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-700">{user?.name}</p>
            <p className="text-xs text-slate-500">Professional Driver</p>
          </div>
          {user && (
            <Link to="/driver/profile" title="View Profile">
              <Avatar name={user.name} size="sm" />
            </Link>
          )}

          <button
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogoutIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        {/* Welcome & Metrics */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold text-slate-900">
                Welcome back, {user?.name?.split(' ')[0] || 'Driver'}!
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                View your vehicle assignments, tour schedules, and traveler contact details.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-2.5 text-center">
                <span className="text-xl font-bold text-blue-700">{upcomingTasks.length}</span>
                <span className="block text-xs font-medium text-blue-600">Active / Upcoming</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center">
                <span className="text-xl font-bold text-slate-700">{pastTasks.length}</span>
                <span className="block text-xs font-medium text-slate-500">Past / Other</span>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-6 flex border-b border-slate-100 gap-4">
            <button
              onClick={() => setFilter('upcoming')}
              className={`pb-3 text-sm font-semibold transition border-b-2 ${
                filter === 'upcoming'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Upcoming Tours ({upcomingTasks.length})
            </button>
            <button
              onClick={() => setFilter('past')}
              className={`pb-3 text-sm font-semibold transition border-b-2 ${
                filter === 'past'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Past / Completed ({pastTasks.length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`pb-3 text-sm font-semibold transition border-b-2 ${
                filter === 'all'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              All Assignments ({assignments?.length ?? 0})
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 flex items-center justify-between">
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
              <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-6" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && displayedTasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <TruckIcon className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-heading text-lg font-bold text-slate-800">
              No active driving assignments
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              You do not have any {filter === 'upcoming' ? 'upcoming' : ''} tour vehicle assignments scheduled right now.
            </p>
            <button
              onClick={load}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
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
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    {/* Dates & Status */}
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            isCancelled
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : isPast
                                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isCancelled ? 'bg-red-500' : isPast ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'
                            }`}
                          />
                          {isCancelled ? 'Cancelled Tour' : isPast ? 'Tour Completed' : 'Active Tour Task'}
                        </span>

                        {task.vehicleType && <VehicleTypeBadge type={task.vehicleType} />}

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            task.hasAC ? 'bg-cyan-50 text-cyan-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {task.hasAC ? 'Air Conditioned (AC)' : 'Non-AC'}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-lg font-bold text-slate-900">
                            {task.packageName || 'Expedition Tour Package'}
                          </span>
                          {task.packageTier && (
                            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                              {task.packageTier}
                            </span>
                          )}
                        </div>
                        {task.itineraryHighlights && task.itineraryHighlights.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {task.itineraryHighlights.map((hl, idx) => (
                              <span
                                key={idx}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                              >
                                &bull; {hl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-slate-700 font-medium text-sm">
                        <CalendarIcon className="h-4 w-4 text-slate-400" />
                        <span>
                          {task.startDate} &mdash; {task.endDate}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400 font-mono">
                        Booking Ref: {task.bookingId}
                      </p>
                    </div>

                    {/* Registration Tag */}
                    <div className="sm:text-right">
                      <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                        Assigned Vehicle
                      </p>
                      <span className="mt-1 inline-block rounded-lg bg-slate-900 px-3 py-1 font-mono text-sm font-bold tracking-wider text-amber-300 shadow-inner">
                        {task.registrationNumber || 'NO REG'}
                      </span>
                      {task.capacity && (
                        <p className="mt-1 text-xs text-slate-500">
                          Capacity: {task.capacity} Passengers
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Passenger / Traveler Information */}
                  <div className="mt-5 border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Lead Traveler / Passenger
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-800">
                        {task.travelerName || 'Guest Traveler'}
                      </p>
                      {task.travelerContact ? (
                        <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-600">
                          <PhoneIcon className="h-3.5 w-3.5 text-slate-400" />
                          <span>{task.travelerContact}</span>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">Contact number unavailable</p>
                      )}
                    </div>

                    <div className="flex sm:justify-end items-center gap-2">
                      {task.travelerContact && (
                        <a
                          href={`tel:${task.travelerContact}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          <PhoneIcon className="h-3.5 w-3.5 text-blue-600" />
                          Call Traveler
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleExpand(task.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                      >
                        {expandedTasks.has(task.id) ? 'Less Info ▲' : 'More Info ▼'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Full Booking Details Section */}
                  {expandedTasks.has(task.id) && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">
                            Assigned Tour Guide
                          </span>
                          <span className="font-bold text-slate-800">
                            {task.guideName ? `${task.guideName} (${task.guideContact || 'No phone'})` : 'Independent Driver Tour'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">
                            Party / Group Size
                          </span>
                          <span className="font-bold text-slate-800">
                            {task.groupSize ? `${task.groupSize} Guests` : 'Standard Booking'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">
                            Language Preference
                          </span>
                          <span className="font-bold text-slate-800">
                            {task.languagePreference || 'English'}
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">
                            Special Requests / Client Notes
                          </span>
                          <span className="font-medium text-slate-700">
                            {task.specialRequests || 'None specified'}
                          </span>
                        </div>
                      </div>

                      {task.itineraryHighlights && task.itineraryHighlights.length > 0 && (
                        <div className="pt-2 border-t border-slate-200">
                          <span className="font-semibold text-slate-600 block mb-1">
                            Tour Itinerary Timeline:
                          </span>
                          <ul className="space-y-1 text-slate-600 list-disc list-inside">
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
      </main>
    </div>
  );
}
