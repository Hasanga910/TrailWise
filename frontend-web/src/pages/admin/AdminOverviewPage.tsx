import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getPackages, type TourPackage } from '../../api/packages';
import { getStaff, type StaffMember } from '../../api/staff';
import { useAuth } from '../../auth/AuthContext';
import {
  ArrowRightIcon,
  GroupSizeIcon,
  PackagesIcon,
  ProfileIcon,
  SparkleIcon,
  TagIcon,
  UsersIcon,
} from '../../components/admin/icons';

const CARDS = [
  {
    to: '/admin/packages',
    title: 'Packages',
    description: 'View all tour packages, or jump into management to create, edit, and remove them.',
    icon: PackagesIcon,
  },
  {
    to: '/admin/staff',
    title: 'User Management',
    description: 'Manage Tour Guide, Operations Manager, and Fleet Coordinator accounts.',
    icon: UsersIcon,
  },
  {
    to: '/admin/profile',
    title: 'Profile',
    description: 'Update your own name, email, and password.',
    icon: ProfileIcon,
  },
];

const ROLE_LABELS: Record<string, string> = {
  TourGuide: 'Tour Guide',
  OperationsManager: 'Operations Manager',
  FleetCoordinator: 'Fleet Coordinator',
  Admin: 'Admin',
};

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof PackagesIcon;
  label: string;
  value: string;
  tone: 'brand' | 'accent';
}) {
  const badgeClass =
    tone === 'brand'
      ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white'
      : 'bg-gradient-to-br from-accent-400 to-accent-600 text-white';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg shadow-sm ${badgeClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-0.5 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function BarRow({ label, count, max, colorClass }: { label: string; count: number; max: number; colorClass: string }) {
  const widthPct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-slate-900">{count}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-100">
        <div
          className={`h-2.5 rounded-full ${colorClass}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

function BarPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-heading text-sm font-bold text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Meter({
  label,
  percent,
  fillClass,
  trackClass,
}: {
  label: string;
  percent: number;
  fillClass: string;
  trackClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-lg font-semibold text-slate-900">{Math.round(percent)}%</span>
      </div>
      <div className={`h-2.5 w-full rounded-full ${trackClass}`}>
        <div className={`h-2.5 rounded-full ${fillClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function AdminOverviewPage() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<TourPackage[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPackages(), getStaff()])
      .then(([pkgs, staffList]) => {
        setPackages(pkgs);
        setStaff(staffList);
      })
      .catch((err) => setError(extractErrorMessage(err, 'Could not load dashboard data.')));
  }, []);

  const stats = useMemo(() => {
    if (!packages || !staff) return null;

    const allTiers = packages.flatMap((p) => p.tiers);
    const totalPackages = packages.length;
    const totalStaff = staff.length;
    const avgPrice = totalPackages
      ? packages.reduce((sum, p) => sum + p.basePricePerPerson, 0) / totalPackages
      : 0;
    const avgGroupSize = totalPackages
      ? Math.round(packages.reduce((sum, p) => sum + p.maxGroupSize, 0) / totalPackages)
      : 0;

    const roleCounts: Record<string, number> = { TourGuide: 0, OperationsManager: 0, FleetCoordinator: 0, Admin: 0 };
    for (const member of staff) {
      roleCounts[member.role] = (roleCounts[member.role] ?? 0) + 1;
    }
    const staffByRole = Object.entries(roleCounts)
      .map(([role, count]) => ({ label: ROLE_LABELS[role] ?? role, count }))
      .sort((a, b) => b.count - a.count);

    const themeCounts = new Map<string, number>();
    for (const pkg of packages) {
      themeCounts.set(pkg.theme, (themeCounts.get(pkg.theme) ?? 0) + 1);
    }
    const packagesByTheme = [...themeCounts.entries()]
      .map(([theme, count]) => ({ label: theme, count }))
      .sort((a, b) => b.count - a.count);

    const classCounts = { First: 0, Second: 0, Normal: 0 };
    for (const tier of allTiers) {
      classCounts[tier.classType] += 1;
    }
    const tierClassMix = [
      { label: 'First', count: classCounts.First, colorClass: 'bg-brand-700' },
      { label: 'Second', count: classCounts.Second, colorClass: 'bg-brand-500' },
      { label: 'Normal', count: classCounts.Normal, colorClass: 'bg-brand-300' },
    ];

    const totalTiers = allTiers.length;
    const foodPct = totalTiers ? (allTiers.filter((t) => t.includesFood).length / totalTiers) * 100 : 0;
    const acPct = totalTiers ? (allTiers.filter((t) => t.requiresAC).length / totalTiers) * 100 : 0;

    return { totalPackages, totalStaff, avgPrice, avgGroupSize, staffByRole, packagesByTheme, tierClassMix, foodPct, acPct };
  }, [packages, staff]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-950 px-6 py-8 text-white shadow-lg sm:px-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-8 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-accent-300">
            <SparkleIcon className="h-3.5 w-3.5" /> Admin Console
          </span>
          <h2 className="mt-3 font-heading text-2xl font-bold sm:text-3xl">
            Welcome back, {user?.name?.split(' ')[0] ?? 'Admin'}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-white/75">
            Here's how TrailWise looks right now — packages, staff, and pricing at a glance.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!error && !stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      )}

      {stats && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={PackagesIcon} label="Total packages" value={String(stats.totalPackages)} tone="brand" />
            <StatTile icon={UsersIcon} label="Total staff" value={String(stats.totalStaff)} tone="accent" />
            <StatTile
              icon={TagIcon}
              label="Average price / person"
              value={`$${stats.avgPrice.toFixed(0)}`}
              tone="brand"
            />
            <StatTile
              icon={GroupSizeIcon}
              label="Average max group size"
              value={String(stats.avgGroupSize)}
              tone="accent"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <BarPanel title="Staff by role">
              {stats.staffByRole.map((row) => (
                <BarRow key={row.label} label={row.label} count={row.count} max={stats.totalStaff} colorClass="bg-brand-600" />
              ))}
            </BarPanel>

            <BarPanel title="Packages by theme">
              {stats.packagesByTheme.length === 0 && <p className="text-sm text-slate-500">No packages yet.</p>}
              {stats.packagesByTheme.map((row) => (
                <BarRow
                  key={row.label}
                  label={row.label}
                  count={row.count}
                  max={stats.totalPackages}
                  colorClass="bg-accent-500"
                />
              ))}
            </BarPanel>

            <BarPanel title="Tier class mix">
              {stats.tierClassMix.map((row) => (
                <BarRow
                  key={row.label}
                  label={row.label}
                  count={row.count}
                  max={Math.max(...stats.tierClassMix.map((r) => r.count), 1)}
                  colorClass={row.colorClass}
                />
              ))}
            </BarPanel>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Meter label="Tiers including food" percent={stats.foodPct} fillClass="bg-brand-500" trackClass="bg-brand-100" />
            <Meter label="Tiers requiring AC" percent={stats.acPct} fillClass="bg-accent-500" trackClass="bg-accent-400/20" />
          </div>
        </>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Quick links</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.to}
                to={card.to}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-heading text-lg font-bold text-slate-900">{card.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{card.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                  Open
                  <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}