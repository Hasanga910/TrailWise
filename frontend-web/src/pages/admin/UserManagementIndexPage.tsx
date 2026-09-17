import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getStaff, type StaffMember, type StaffRole } from '../../api/staff';
import { ArrowRightIcon, BriefcaseIcon, CompassIcon, TruckIcon } from '../../components/admin/icons';

const CARDS: {
  to: string;
  title: string;
  description: string;
  role: StaffRole;
  icon: typeof CompassIcon;
  fromClass: string;
  toClass: string;
}[] = [
  {
    to: '/admin/staff/tour-guides',
    title: 'Tour Guides',
    description: 'Add or remove Tour Guide accounts who lead travelers on trips.',
    role: 'TourGuide',
    icon: CompassIcon,
    fromClass: 'from-brand-500',
    toClass: 'to-brand-700',
  },
  {
    to: '/admin/staff/operations-managers',
    title: 'Operations Managers',
    description: 'Add or remove Operations Manager accounts who run day-to-day logistics.',
    role: 'OperationsManager',
    icon: BriefcaseIcon,
    fromClass: 'from-accent-400',
    toClass: 'to-accent-600',
  },
  {
    to: '/admin/staff/fleet-coordinators',
    title: 'Fleet Coordinators',
    description: 'Add or remove Fleet Coordinator accounts who manage vehicles and drivers.',
    role: 'FleetCoordinator',
    icon: TruckIcon,
    fromClass: 'from-brand-400',
    toClass: 'to-brand-600',
  },
];

export function UserManagementIndexPage() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStaff()
      .then(setStaff)
      .catch((err) => setError(extractErrorMessage(err, 'Could not load staff.')));
  }, []);

  function countFor(role: StaffRole): number | null {
    if (!staff) return null;
    return staff.filter((member) => member.role === role).length;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Each staff role has its own page for creating and removing accounts.
        </p>
        {staff && (
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{staff.length}</span> total staff accounts
          </p>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const count = countFor(card.role);
          return (
            <Link
              key={card.to}
              to={card.to}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${card.fromClass} ${card.toClass} text-white shadow-sm`}
              >
                <Icon className="h-6 w-6" />
              </div>

              <h2 className="mt-4 font-heading text-lg font-bold text-slate-900">{card.title}</h2>
              <p className="mt-1.5 flex-1 text-sm text-slate-500">{card.description}</p>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-2xl font-bold text-slate-900">
                  {count === null ? (
                    <span className="inline-block h-7 w-8 animate-pulse rounded bg-slate-200 align-middle" />
                  ) : (
                    count
                  )}
                  <span className="ml-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {count === 1 ? 'account' : 'accounts'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                  Manage
                  <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}