import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ChevronRight, Hourglass, Package, Ticket, User, type LucideIcon } from 'lucide-react';
import sigiriya1024 from '../../assets/hero/sigiriya-rock-fortress-1024.webp';
import sigiriya640 from '../../assets/hero/sigiriya-rock-fortress-640.webp';
import { getMyBookings, type BookingDto } from '../../api/bookings';
import { getPackages, type TourPackage } from '../../api/packages';
import { useAuth } from '../../auth/AuthContext';
import { PackageCard } from '../../components/explorer/PackageCard';
import { buttonClasses, Card, EmptyState, StatusBadge } from '../../components/ui';
import { formatDate } from '../../utils/format';

const LINKS: { to: string; title: string; description: string; icon: LucideIcon }[] = [
  { to: '/traveler/packages', title: 'Browse Packages', description: 'Explore tour packages and their pricing tiers.', icon: Package },
  { to: '/traveler/bookings', title: 'My Bookings', description: 'Track the status of your booking requests.', icon: Ticket },
  { to: '/traveler/profile', title: 'Profile', description: 'Update your own name, email, and password.', icon: User },
];

interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
}

/** Same booking-request entry the browse page uses, on the cheapest tier. */
function requestPath(pkg: TourPackage): string | undefined {
  const tier = [...pkg.tiers].sort((a, b) => a.basePricePerPerson - b.basePricePerPerson)[0];
  return tier ? `/traveler/bookings/new?tier=${tier.id}` : undefined;
}

export function TravelerDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [recent, setRecent] = useState<BookingDto[] | null>(null);
  const [recommended, setRecommended] = useState<TourPackage[]>([]);

  useEffect(() => {
    Promise.all([
      getMyBookings({ pageSize: 3 }),
      getMyBookings({ status: 'PendingApproval', pageSize: 1 }),
      getMyBookings({ status: 'Confirmed', pageSize: 1 }),
    ])
      .then(([all, pending, confirmed]) => {
        setStats({ total: all.totalCount, pending: pending.totalCount, confirmed: confirmed.totalCount });
        setRecent(all.items ?? []);
      })
      .catch(() => {
        setStats(null);
        setRecent(null);
      });
  }, []);

  useEffect(() => {
    getPackages()
      .then((packages) => setRecommended(packages.slice(0, 3)))
      .catch(() => setRecommended([]));
  }, []);

  const upcomingCount = stats?.total ?? null;

  return (
    <div className="space-y-8">
      <section className="relative isolate overflow-hidden rounded-card bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white shadow-soft sm:p-8">
        <img
          src={sigiriya1024}
          srcSet={`${sigiriya640} 640w, ${sigiriya1024} 1024w`}
          sizes="(min-width: 1024px) 1024px, 100vw"
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/55 to-black/30" aria-hidden />
        <h1 className="font-heading text-h2">
          Welcome back, <span className="font-semibold">{user?.name}</span>.
        </h1>
        <p className="mt-2 max-w-xl text-body-lg text-white/90">
          {upcomingCount !== null &&
            (upcomingCount === 0
              ? "You haven't made any booking requests yet."
              : `You have ${upcomingCount} booking request${upcomingCount === 1 ? '' : 's'} on file.`)}
        </p>
        <Link to="/traveler/packages" className={buttonClasses('primary', 'lg', 'mt-6 w-full sm:w-auto')}>
          Browse packages
        </Link>
      </section>

      {stats && (
        <dl className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: 'Total bookings', value: stats.total, icon: Ticket, tint: 'bg-brand-soft text-brand-fg' },
            { label: 'Pending approval', value: stats.pending, icon: Hourglass, tint: 'bg-warning-soft text-warning-fg' },
            { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle, tint: 'bg-success-soft text-success-fg' },
          ].map(({ icon: Icon, ...stat }) => (
            <Card key={stat.label} className="!p-3 sm:!p-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-input ${stat.tint}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <dt className="mt-3 text-caption text-fg-muted">{stat.label}</dt>
              <dd className="mt-1 font-heading text-h3 text-fg">{stat.value}</dd>
            </Card>
          ))}
        </dl>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {recent !== null && (
          <Card padded={false} className="lg:col-span-2">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 className="font-heading text-h4 text-fg">Recent bookings</h2>
              {recent.length > 0 && (
                <Link to="/traveler/bookings" className="text-body font-semibold text-brand-text hover:underline">
                  View all
                </Link>
              )}
            </div>
            {recent.length === 0 ? (
              <EmptyState
                title="No bookings yet"
                description="Pick a tour package and request your first booking."
                action={
                  <Link to="/traveler/packages" className={buttonClasses('primary', 'md')}>
                    Browse Packages
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((booking) => (
                  <li key={booking.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-fg">
                        {booking.tourPackageName} — {booking.packageTier.classType}
                      </p>
                      <p className="mt-0.5 text-caption text-fg-muted">
                        {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card padded={false} className={recent === null ? 'lg:col-span-3' : undefined}>
          <h2 className="border-b border-border px-5 py-4 font-heading text-h4 text-fg">Quick links</h2>
          <nav aria-label="Quick links">
            <ul className="divide-y divide-border">
              {LINKS.map(({ icon: Icon, ...link }) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-brand-soft text-brand-fg">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-fg">{link.title}</span>
                      <span className="block truncate text-caption text-fg-muted">{link.description}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Card>
      </div>

      {recommended.length > 0 && (
        <section aria-labelledby="recommended-heading">
          <h2 id="recommended-heading" className="font-heading text-h3 text-fg">
            Recommended for you
          </h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} to={requestPath(pkg)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
