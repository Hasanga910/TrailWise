import { CalendarIcon, DashboardIcon, PackagesIcon, ProfileIcon } from '../admin/icons';
import { SidebarLayout, type SidebarNavItem } from '../layout/SidebarLayout';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/ops', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/ops/packages', label: 'Packages', icon: PackagesIcon },
  { to: '/guides/availability', label: 'Guide Availability', icon: CalendarIcon },
  { to: '/ops/profile', label: 'Profile', icon: ProfileIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/ops': 'Dashboard',
  '/ops/packages': 'Packages',
  '/guides/availability': 'Guide Availability',
  '/ops/profile': 'Profile Settings',
};

export function OpsLayout() {
  return <SidebarLayout navItems={NAV_ITEMS} pageTitles={PAGE_TITLES} />;
}
