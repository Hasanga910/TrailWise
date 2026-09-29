import {
  CalendarIcon,
  IdCardIcon,
  ProfileIcon,
  TruckIcon,
} from '../admin/icons';
import { SidebarLayout, type SidebarNavItem } from '../layout/SidebarLayout';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/fleet', label: 'Overview & Allocation', icon: TruckIcon, end: true },
  { to: '/fleet/vehicles', label: 'Vehicles', icon: TruckIcon },
  { to: '/fleet/drivers', label: 'Drivers', icon: IdCardIcon },
  { to: '/fleet/assignments', label: 'Vehicle Assignments', icon: CalendarIcon },
  { to: '/fleet/profile', label: 'Profile', icon: ProfileIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/fleet': 'Fleet & Transport Workspace',
  '/fleet/vehicles': 'Vehicle Management & Fleet Roster',
  '/fleet/drivers': 'Driver Roster & Management',
  '/fleet/assignments': 'Vehicle Assignments & Schedules',
  '/fleet/profile': 'Profile Settings',
};

export function FleetLayout() {
  return <SidebarLayout navItems={NAV_ITEMS} pageTitles={PAGE_TITLES} />;
}

