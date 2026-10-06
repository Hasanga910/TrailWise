import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Ticket, User, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { getMyBookings } from '../../api/bookings';
import { Card } from '../../components/ui';

const CARDS: { to: string; title: string; description: string; icon: LucideIcon }[] = [
  { to: '/traveler/packages', title: 'Browse Packages', description: 'Explore tour packages and their pricing tiers.', icon: Package },
  { to: '/traveler/bookings', title: 'My Bookings', description: 'Track the status of your booking requests.', icon: Ticket },
  { to: '/traveler/profile', title: 'Profile', description: 'Update your own name, email, and password.', icon: User },
];

interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
}

export function TravelerDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<BookingStats | null>(null);

  useEffect(() => {
    Promise.all([
      getMyBookings({ pageSize: 1 }),
      getMyBookings({ status: 'PendingApproval', pageSize: 1 }),
      getMyBookings({ status: 'Confirmed', pageSize: 1 }),
    ])
      .then(([all, pending, confirmed]) =>
        setStats({ total: all.totalCount, pending: pending.totalCount, confirmed: confirmed.totalCount }),
      )
      .catch(() => setStats(null));
  }, []);

  const upcomingCount = stats?.total ?? null;

  return (
    <div>
      <p className="text-body text-fg-muted">
        Welcome back, <span className="font-semibold text-fg">{user?.name}</span>.{' '}
        {upcomingCount !== null &&
          (upcomingCount === 0
            ? "You haven't made any booking requests yet."
            : `You have ${upcomingCount} booking request${upcomingCount === 1 ? '' : 's'} on file.`)}
      </p>

      {stats && (
        <dl className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: 'Total bookings', value: stats.total },
            { label: 'Pending approval', value: stats.pending },
            { label: 'Confirmed', value: stats.confirmed },
          ].map((stat) => (
            <Card key={stat.label} className="!p-3 sm:!p-4">
              <dt className="text-caption text-fg-muted">{stat.label}</dt>
              <dd className="mt-1 font-heading text-h3 text-fg">{stat.value}</dd>
            </Card>
          ))}
        </dl>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(({ icon: Icon, ...card }) => (
          <Link key={card.to} to={card.to} className="block rounded-card">
            <Card interactive className="h-full">
              <span className="flex h-10 w-10 items-center justify-center rounded-input bg-brand-soft text-brand-text">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-3 font-heading text-h4 text-fg">{card.title}</h2>
              <p className="mt-1 text-body text-fg-muted">{card.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
