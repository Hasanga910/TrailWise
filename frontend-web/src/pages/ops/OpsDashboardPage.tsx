import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const CARDS = [
  { to: '/ops/packages', title: 'Packages', description: 'Create, edit, and remove tour packages and tiers.' },
  { to: '/guides/availability', title: 'Guide Availability', description: 'Inspect tour guide availability schedules.' },
  { to: '/ops/profile', title: 'Profile', description: 'Update your own name, email, and password.' },
];

export function OpsDashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <p className="text-sm text-slate-500">
        Welcome back, <span className="font-semibold text-slate-700">{user?.name}</span>. Use the
        sidebar or the cards below to manage tour packages.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
