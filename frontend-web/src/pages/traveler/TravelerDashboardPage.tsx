import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getMyBookings } from '../../api/bookings';

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
      <p className="text-sm text-slate-500">
        Welcome back, <span className="font-semibold text-slate-700">{user?.name}</span>.{' '}
        {upcomingCount !== null &&
          (upcomingCount === 0
            ? "You haven't made any booking requests yet."
            : `You have ${upcomingCount} booking request${upcomingCount === 1 ? '' : 's'} on file.`)}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="font-heading text-lg font-bold text-slate-900">{card.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
