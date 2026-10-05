import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyAssignedTours, type AssignedTourDto } from '../../api/assignedTours';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../components/ui';

const CARDS = [
  {
    to: '/guides/my-tours',
    title: 'My Assigned Tours',
    description: 'View your upcoming and active tours.',
  },
  {
    to: '/guides/availability',
    title: 'Guide Availability',
    description: 'Manage the days you are available for tours.',
  },
  {
    to: '/guides/profile',
    title: 'Profile',
    description: 'Update your guide details, languages, specializations, and password.',
  },
];

export function isUpcomingOrActiveTour(tour: AssignedTourDto): boolean {
  if (tour.completed || tour.tourEndedAt) return false;
  if (tour.status === 'Completed' || tour.status === 'Cancelled') return false;
  return true;
}

export function GuideDashboardPage() {
  const { user } = useAuth();
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);

  useEffect(() => {
    getMyAssignedTours()
      .then((tours) => {
        const count = tours.filter(isUpcomingOrActiveTour).length;
        setUpcomingCount(count);
      })
      .catch(() => setUpcomingCount(null));
  }, []);

  const guideName = user?.name ?? 'Tour Guide';

  return (
    <div>
      <p className="text-body text-fg-muted">
        Welcome back, <span className="font-semibold text-fg">{guideName}</span>.{' '}
        {upcomingCount !== null && (
          `You have ${upcomingCount} upcoming assigned tour${upcomingCount === 1 ? '' : 's'}.`
        )}
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
