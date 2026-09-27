import { BookingsIcon, CalendarIcon, DashboardIcon, PackagesIcon, ProfileIcon, UsersIcon } from '../admin/icons';
import { SidebarLayout, type SidebarNavItem } from '../layout/SidebarLayout';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/ops', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/ops/packages', label: 'Packages', icon: PackagesIcon },
  { to: '/ops/guides', label: 'Guides', icon: UsersIcon },
  { to: '/guides/availability', label: 'Guide Availability', icon: CalendarIcon },
  { to: '/ops/itineraries', label: 'Itineraries', icon: BookingsIcon },
  { to: '/ops/profile', label: 'Profile', icon: ProfileIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/ops': 'Dashboard',
  '/ops/packages': 'Packages',
  '/ops/guides': 'Tour Guides',
  '/ops/guides/new': 'Create Guide',
  '/guides/availability': 'Guide Availability',
  '/ops/itineraries': 'Itinerary Management',
  '/ops/profile': 'Profile Settings',
};

export function OpsLayout() {
  return <SidebarLayout navItems={NAV_ITEMS} pageTitles={PAGE_TITLES} />;
}
