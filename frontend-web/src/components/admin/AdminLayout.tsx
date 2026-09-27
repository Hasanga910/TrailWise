import { SidebarLayout, type SidebarNavItem } from '../layout/SidebarLayout';
import { DashboardIcon, PackagesIcon, ProfileIcon, UsersIcon } from './icons';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: DashboardIcon, end: true },
  {
    to: '/admin/packages',
    label: 'Packages',
    icon: PackagesIcon,
    children: [
      { to: '/admin/packages', label: 'Overview', end: true },
      { to: '/admin/packages/manage', label: 'Management' },
    ],
  },
  {
    to: '/admin/staff',
    label: 'User Management',
    icon: UsersIcon,
    children: [
      { to: '/admin/staff/tour-guides', label: 'Tour Guides' },
      { to: '/admin/staff/operations-managers', label: 'Operations Managers' },
      { to: '/admin/staff/fleet-coordinators', label: 'Fleet Coordinators' },
    ],
  },
  { to: '/admin/profile', label: 'Profile', icon: ProfileIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/packages': 'Packages Overview',
  '/admin/packages/manage': 'Package Management',
  '/admin/staff': 'User Management',
  '/admin/staff/tour-guides': 'Tour Guides',
  '/admin/staff/operations-managers': 'Operations Managers',
  '/admin/staff/fleet-coordinators': 'Fleet Coordinators',
  '/admin/profile': 'Profile Settings',
};

export function AdminLayout() {
  return <SidebarLayout navItems={NAV_ITEMS} pageTitles={PAGE_TITLES} />;
}
