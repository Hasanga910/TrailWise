import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getStaff, type StaffMember, type StaffRole } from '../../api/staff';
import { ArrowRightIcon, BriefcaseIcon, CompassIcon, TruckIcon } from '../../components/admin/icons';
import { Card, Skeleton } from '../../components/ui';

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
  {
    to: '/admin/staff/drivers',
    title: 'Drivers',
    description: 'Add or remove Driver accounts who operate vehicles and complete tour transfers.',
    role: 'Driver',
    icon: TruckIcon,
    fromClass: 'from-brand-600',
    toClass: 'to-brand-800',
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
        <p className="text-body text-fg-muted">
          Each staff role has its own page for creating and removing accounts.
        </p>
        {staff && (
          <p className="text-body text-fg-muted">
            <span className="font-semibold text-fg">{staff.length}</span> total staff accounts
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-input border border-danger/30 bg-danger-soft px-4 py-3 text-body font-medium text-danger-fg">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const count = countFor(card.role);
          return (
            <Link key={card.to} to={card.to} className="group block rounded-card">
              <Card interactive className="flex h-full flex-col p-6">
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-card bg-gradient-to-br ${card.fromClass} ${card.toClass} text-white shadow-soft`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <h2 className="mt-4 font-heading text-h3 text-fg">{card.title}</h2>
                <p className="mt-1.5 flex-1 text-body text-fg-muted">{card.description}</p>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="font-heading text-h2 text-fg">
                    {count === null ? <Skeleton className="inline-block h-7 w-8 align-middle" /> : count}
                    <span className="ml-1.5 text-overline text-fg-muted">{count === 1 ? 'account' : 'accounts'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-body font-semibold text-brand-text">
                    Manage
                    <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}