import { useState, type ComponentType, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import logoIcon from '../../assets/logo-icon.png';
import { Avatar } from '../Avatar';
import { Logo } from '../Logo';
import { ChevronIcon, CloseIcon, LogoutIcon, MenuIcon } from '../admin/icons';

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  Admin: 'Administrator',
  OperationsManager: 'Operations Manager',
  TourGuide: 'Tour Guide',
  FleetCoordinator: 'Fleet Coordinator',
  Traveler: 'Traveler',
};

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  children?: { to: string; label: string; end?: boolean }[];
}

export interface SidebarLayoutProps {
  navItems: SidebarNavItem[];
  pageTitles: Record<string, string>;
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
    // ignore (private mode / storage disabled) — collapse still works for this session
  }
}

export function SidebarLayout({ navItems, pageTitles }: SidebarLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  const title = pageTitles[location.pathname] ?? 'Dashboard';

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      writeStoredCollapsed(next);
      return next;
    });
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const collapsedNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-center rounded-lg p-2.5 transition ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const subNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`;

  function renderNav(isCollapsed: boolean) {
    return navItems.map((item) => {
      const Icon = item.icon;

      if (isCollapsed) {
        return (
          <NavLink key={item.to} to={item.to} end={item.end} title={item.label} className={collapsedNavLinkClass}>
            <Icon className="h-5 w-5 shrink-0" />
          </NavLink>
        );
      }

      if (item.children) {
        return (
          <div key={item.to} className="pt-4">
            <p className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Icon className="h-4 w-4" /> {item.label}
            </p>
            <div className="mt-1 space-y-1 pl-3">
              {item.children.map((child) => (
                <NavLink key={child.to} to={child.to} end={child.end} className={subNavLinkClass}>
                  {child.label}
                </NavLink>
              ))}
            </div>
          </div>
        );
      }

      return (
        <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
          <Icon className="h-5 w-5 shrink-0" />
          {item.label}
        </NavLink>
      );
    });
  }

  function sidebarChrome(isCollapsed: boolean, showCollapseToggle: boolean): ReactNode {
    return (
      <>
        <div className={`relative flex items-center overflow-hidden px-4 py-5 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-brand-50 via-transparent to-transparent" />
          {isCollapsed ? (
            <img src={logoIcon} alt="TrailWise" className="relative z-10 h-8 w-8 object-contain" />
          ) : (
            <Logo className="relative z-10 h-7 w-auto" />
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="relative z-10 text-slate-500 hover:text-slate-700 md:hidden"
            aria-label="Close menu"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {showCollapseToggle && (
          <div className={`hidden px-4 pb-2 md:flex ${isCollapsed ? 'justify-center' : 'justify-end'}`}>
            <button
              onClick={toggleCollapsed}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronIcon className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}

        <nav className={`flex-1 space-y-1 overflow-y-auto px-3 pb-4 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          {renderNav(isCollapsed)}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            onClick={logout}
            title="Log out"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 ${
              isCollapsed ? 'w-auto justify-center' : 'w-full'
            }`}
          >
            <LogoutIcon className="h-5 w-5 shrink-0" />
            {!isCollapsed && 'Log out'}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-svh bg-slate-50 md:flex">
      <aside
        className={`hidden md:flex md:flex-none md:flex-col md:border-r md:border-slate-200 md:bg-white ${
          collapsed ? 'md:w-20' : 'md:w-64'
        }`}
      >
        {sidebarChrome(collapsed, true)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-white shadow-xl">
            {sidebarChrome(false, false)}
          </aside>
        </div>
      )}

      <div className="flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-brand-500 before:via-accent-500 before:to-brand-500">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-slate-500 hover:text-slate-700 md:hidden"
              aria-label="Open menu"
            >
              <MenuIcon className="h-6 w-6" />
            </button>
            <h1 className="font-heading text-lg font-bold text-slate-900">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-700">{user?.name}</p>
              <p className="text-xs text-slate-500">{user && (ROLE_DISPLAY_LABELS[user.role] ?? user.role)}</p>
            </div>
            {user && <Avatar name={user.name} size="sm" />}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}