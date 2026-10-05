import { Suspense, useState, type ComponentType, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronLeft, LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import logoIcon from '../../assets/logo-icon.png';
import { ThemeToggle } from '../../theme/ThemeToggle';
import { useTheme } from '../../theme/useTheme';
import { Avatar } from '../ui/Avatar';
import { Breadcrumbs } from '../ui/PageHeader';
import { cn } from '../ui/cn';
import { PageSkeleton } from '../ui/Skeleton';
import { Drawer } from '../ui/Drawer';
import { DropdownMenu, type MenuEntry } from '../ui/DropdownMenu';
import { IconButton } from '../ui/IconButton';
import { Logo } from '../Logo';

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  Admin: 'Administrator',
  OperationsManager: 'Operations Manager',
  TourGuide: 'Tour Guide',
  FleetCoordinator: 'Fleet Coordinator',
  Traveler: 'Traveler',
  Driver: 'Driver',
};

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  /** Items sharing a `section` are grouped under a small heading. */
  section?: string;
  /** A count shown next to the label (for example waiting approvals). Hidden when null, undefined or 0. */
  badge?: number | null;
  children?: { to: string; label: string; end?: boolean }[];
}

export interface AppShellProps {
  navItems: SidebarNavItem[];
  pageTitles: Record<string, string> | ((pathname: string) => string);
  /** Root breadcrumb, e.g. "Guide Portal". */
  portalLabel?: string;
  /** Optional page content; defaults to the router outlet. */
  children?: ReactNode;
}

const COLLAPSE_STORAGE_KEY = 'trailwise_sidebar_collapsed';

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(value));
  } catch {
    // ignore (private mode / storage disabled): collapse still works for this session
  }
}

const linkBase = 'flex items-center gap-3 rounded-input px-3 py-2 text-body font-semibold transition duration-150';
const linkIdle = 'text-fg-muted hover:bg-surface-sunken hover:text-fg';
const linkActive = 'bg-brand-soft text-brand-fg';

function badgeLabel(item: SidebarNavItem): string {
  return item.badge ? `${item.label}, ${item.badge} waiting` : item.label;
}

export function AppShell({ navItems, pageTitles, portalLabel, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  const title =
    typeof pageTitles === 'function' ? pageTitles(location.pathname) : (pageTitles[location.pathname] ?? 'Dashboard');
  const homeTo = navItems[0]?.to;
  const crumbs = portalLabel ? [{ label: portalLabel, to: homeTo }, { label: title }] : [];
  const roleLabel = user ? (ROLE_DISPLAY_LABELS[user.role] ?? user.role) : '';

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      writeStoredCollapsed(next);
      return next;
    });
  }

  function renderNav(isCollapsed: boolean, onNavigate?: () => void) {
    let lastSection: string | undefined;
    return navItems.map((item) => {
      const Icon = item.icon;
      const sectionHeading =
        item.section && item.section !== lastSection ? (
          isCollapsed ? (
            <div key={`sec-${item.section}`} role="separator" className="my-2 h-px w-8 bg-border" />
          ) : (
            <p key={`sec-${item.section}`} className="px-3 pb-1 pt-4 text-overline text-fg-muted/80">
              {item.section}
            </p>
          )
        ) : null;
      lastSection = item.section ?? lastSection;

      let node: ReactNode;
      if (isCollapsed) {
        node = (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            aria-label={badgeLabel(item)}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn('relative flex items-center justify-center rounded-input p-2.5 transition', isActive ? linkActive : linkIdle)
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.badge ? (
              <span aria-hidden className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-surface-raised" />
            ) : null}
          </NavLink>
        );
      } else if (item.children) {
        node = (
          <div key={item.to} className="pt-3">
            <p className="flex items-center gap-2 px-3 pb-1 text-overline text-fg-muted/80">
              <Icon className="h-4 w-4" /> {item.label}
            </p>
            <div className="mt-1 space-y-1 pl-3">
              {item.children.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  end={child.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn('block rounded-input px-3 py-2 text-body font-medium transition', isActive ? linkActive : linkIdle)
                  }
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          </div>
        );
      } else {
        node = (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => cn(linkBase, isActive ? linkActive : linkIdle)}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <span
                aria-label={`${item.badge} waiting`}
                className="rounded-full bg-warning-soft px-2 py-0.5 text-caption font-bold text-warning-fg"
              >
                {item.badge}
              </span>
            ) : null}
          </NavLink>
        );
      }
      return sectionHeading ? [sectionHeading, node] : node;
    });
  }

  function sidebarChrome(isCollapsed: boolean, showCollapseToggle: boolean, onNavigate?: () => void): ReactNode {
    return (
      <>
        <div className={cn('relative flex items-center px-4 py-5', isCollapsed ? 'justify-center' : 'justify-between')}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-brand-soft via-transparent to-transparent" />
          {isCollapsed ? (
            <img src={logoIcon} alt="TrailWise" className="relative z-10 h-8 w-8 object-contain" />
          ) : (
            <Logo className="relative z-10 h-7 w-auto" />
          )}
        </div>

        {showCollapseToggle && (
          <div className={cn('flex px-4 pb-2', isCollapsed ? 'justify-center' : 'justify-end')}>
            <IconButton
              size="sm"
              label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              icon={<ChevronLeft className={cn('h-4 w-4 transition-transform', isCollapsed && 'rotate-180')} />}
              onClick={toggleCollapsed}
            />
          </div>
        )}

        <nav
          aria-label="Primary"
          className={cn('flex-1 space-y-1 overflow-y-auto px-3 pb-4', isCollapsed && 'flex flex-col items-center')}
        >
          {renderNav(isCollapsed, onNavigate)}
        </nav>

        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={logout}
            title="Log out"
            className={cn(
              'flex items-center gap-3 rounded-input px-3 py-2 text-body font-semibold text-danger transition hover:bg-danger-soft',
              isCollapsed ? 'w-auto justify-center' : 'w-full',
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden />
            {isCollapsed ? <span className="sr-only">Log out</span> : 'Log out'}
          </button>
        </div>
      </>
    );
  }

  const themeEntries: MenuEntry[] = [
    { heading: 'Appearance' },
    ...([
      ['light', 'Light', Sun],
      ['dark', 'Dark', Moon],
    ] as const).map(([value, label, Icon]) => ({
      label,
      icon: <Icon className="h-4 w-4" aria-hidden />,
      selected: preference === value,
      onSelect: () => setPreference(value),
    })),
  ];

  return (
    <div className="min-h-svh bg-surface-sunken md:flex">
      <aside
        className={cn(
          'sticky top-0 hidden h-svh flex-none flex-col border-r border-border bg-surface-raised transition-[width] duration-200 md:flex',
          collapsed ? 'md:w-20' : 'md:w-64',
        )}
      >
        {sidebarChrome(collapsed, true)}
      </aside>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Navigation" side="left" bare>
        <div className="flex h-full flex-col">{sidebarChrome(false, false, () => setMobileOpen(false))}</div>
      </Drawer>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface-raised/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <IconButton
              label="Open menu"
              className="md:hidden"
              icon={<Menu className="h-5 w-5" />}
              onClick={() => setMobileOpen(true)}
            />
            <div className="min-w-0">
              <Breadcrumbs items={crumbs} className="hidden sm:block" />
              <h1 className="truncate font-heading text-h3 text-fg">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-body font-semibold text-fg">{user?.name}</p>
              <p className="text-caption text-fg-muted">{roleLabel}</p>
            </div>
            <DropdownMenu
              trigger={(props) => (
                <button
                  type="button"
                  {...props}
                  aria-label="Account menu"
                  className="rounded-full transition hover:opacity-90"
                >
                  {user ? <Avatar name={user.name} size="sm" /> : <Avatar name="?" size="sm" />}
                </button>
              )}
              header={
                <div className="px-3 py-2">
                  <p className="text-body font-semibold text-fg">{user?.name}</p>
                  {user?.email && <p className="truncate text-caption text-fg-muted">{user.email}</p>}
                </div>
              }
              items={[
                ...themeEntries,
                'separator',
                { label: 'Log out', icon: <LogOut className="h-4 w-4" aria-hidden />, onSelect: logout, tone: 'danger' },
              ]}
            />
          </div>
        </header>
        <main key={location.pathname} className="animate-page-in mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <Suspense fallback={<PageSkeleton />}>{children ?? <Outlet />}</Suspense>
        </main>
      </div>
    </div>
  );
}
