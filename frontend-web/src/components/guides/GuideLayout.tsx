import { BookingsIcon, CalendarIcon, DashboardIcon, ProfileIcon } from '../admin/icons';
import { SidebarLayout, type SidebarNavItem } from '../layout/SidebarLayout';

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

export function GuideLayout() {
  return <SidebarLayout navItems={NAV_ITEMS} pageTitles={PAGE_TITLES} />;
}
