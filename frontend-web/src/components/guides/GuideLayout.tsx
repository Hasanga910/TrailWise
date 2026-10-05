import { BookingsIcon, CalendarIcon, DashboardIcon, ProfileIcon } from '../admin/icons';
import { AppShell, type SidebarNavItem } from '../layout/AppShell';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/guides', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/guides/my-tours', label: 'My Tours', icon: BookingsIcon },
  { to: '/guides/availability', label: 'Guide Availability', icon: CalendarIcon },
  { to: '/guides/profile', label: 'Profile', icon: ProfileIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/guides': 'Dashboard',
  '/guides/dashboard': 'Dashboard',
  '/guides/my-tours': 'My Tours',
  '/guides/availability': 'Guide Availability',
  '/guides/profile': 'Profile',
};

function resolveTitle(pathname: string): string {
  if (/^\/guides\/my-tours\/[^/]+$/.test(pathname)) return 'Tour Details';
  return PAGE_TITLES[pathname] ?? 'Dashboard';
}

export function GuideLayout() {
  return <AppShell navItems={NAV_ITEMS} pageTitles={resolveTitle} portalLabel="Guide Portal" />;
}
