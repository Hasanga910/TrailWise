import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import { getPackages, type TourPackage } from '../../api/packages';
import { getStaff, type StaffMember } from '../../api/staff';
import { useAuth } from '../../auth/AuthContext';
import { GroupSizeIcon, PackagesIcon, TagIcon, UsersIcon } from '../../components/admin/icons';

const CARDS = [
  {
    to: '/admin/packages',
    title: 'Packages',
    description: 'View all tour packages, or jump into management to create, edit, and remove them.',
  },
  {
    to: '/admin/staff',
    title: 'User Management',
    description: 'Manage Tour Guide, Operations Manager, and Fleet Coordinator accounts.',
  },
  { to: '/admin/profile', title: 'Profile', description: 'Update your own name, email, and password.' },
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
  const badgeClass = tone === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-accent-500/15 text-accent-700';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${badgeClass}`}>
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
      <p className="text-sm text-slate-500">
        Welcome back, <span className="font-semibold text-slate-700">{user?.name}</span>. Here's how
        TrailWise looks right now.
      </p>

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
          {CARDS.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="font-heading text-lg font-bold text-slate-900">{card.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{card.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
