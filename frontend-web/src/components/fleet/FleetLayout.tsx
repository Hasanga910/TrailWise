import { ProfileIcon, TruckIcon } from '../admin/icons';
import { SidebarLayout, type SidebarNavItem } from '../layout/SidebarLayout';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/fleet', label: 'Fleet Management', icon: TruckIcon, end: true },
  { to: '/fleet/profile', label: 'Profile', icon: ProfileIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/fleet': 'Fleet & Transport Management',
  '/fleet/profile': 'Profile Settings',
};

export function FleetLayout() {
  return <SidebarLayout navItems={NAV_ITEMS} pageTitles={PAGE_TITLES} />;
}
