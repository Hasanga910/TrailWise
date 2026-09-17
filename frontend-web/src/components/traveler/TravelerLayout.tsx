import { DashboardIcon, ProfileIcon } from '../admin/icons';
import { SidebarLayout, type SidebarNavItem } from '../layout/SidebarLayout';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/traveler', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/traveler/profile', label: 'Profile', icon: ProfileIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/traveler': 'Dashboard',
  '/traveler/profile': 'Profile Settings',
};

export function TravelerLayout() {
  return <SidebarLayout navItems={NAV_ITEMS} pageTitles={PAGE_TITLES} />;
}
