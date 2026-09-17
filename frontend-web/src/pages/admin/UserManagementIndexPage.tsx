import { Link } from 'react-router-dom';

const CARDS = [
  {
    to: '/admin/staff/tour-guides',
    title: 'Tour Guides',
    description: 'Add or remove Tour Guide accounts.',
  },
  {
    to: '/admin/staff/operations-managers',
    title: 'Operations Managers',
    description: 'Add or remove Operations Manager accounts.',
  },
  {
    to: '/admin/staff/fleet-coordinators',
    title: 'Fleet Coordinators',
    description: 'Add or remove Fleet Coordinator accounts.',
  },
];

export function UserManagementIndexPage() {
  return (
    <div>
      <p className="mb-6 text-sm text-slate-500">
        Each staff role has its own page for creating and removing accounts.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
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
