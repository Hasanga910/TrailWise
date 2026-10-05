import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getMyBookings } from '../../api/bookings';
import { Card } from '../../components/ui';

const CARDS = [
  { to: '/traveler/packages', title: 'Browse Packages', description: 'Explore tour packages and their pricing tiers.' },
  { to: '/traveler/bookings', title: 'My Bookings', description: 'Track the status of your booking requests.' },
  { to: '/traveler/profile', title: 'Profile', description: 'Update your own name, email, and password.' },
];

export function TravelerDashboardPage() {
  const { user } = useAuth();
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);

  useEffect(() => {
    getMyBookings({ pageSize: 1 })
      .then((result) => setUpcomingCount(result.totalCount))
      .catch(() => setUpcomingCount(null));
  }, []);

  return (
    <div>
      <p className="text-body text-fg-muted">
        Welcome back, <span className="font-semibold text-fg">{user?.name}</span>.{' '}
        {upcomingCount !== null &&
          (upcomingCount === 0
            ? "You haven't made any booking requests yet."
            : `You have ${upcomingCount} booking request${upcomingCount === 1 ? '' : 's'} on file.`)}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link key={card.to} to={card.to} className="block rounded-card">
            <Card interactive className="h-full">
              <h2 className="font-heading text-h4 text-fg">{card.title}</h2>
              <p className="mt-1 text-body text-fg-muted">{card.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
