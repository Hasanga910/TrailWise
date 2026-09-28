import {
  BookingsIcon,
  CalendarIcon,
  IdCardIcon,
  ProfileIcon,
  TruckIcon,
} from '../admin/icons';
import { SidebarLayout, type SidebarNavItem } from '../layout/SidebarLayout';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/fleet', label: 'Fleet Management', icon: TruckIcon, end: true },
  { to: '/fleet/drivers', label: 'Drivers', icon: IdCardIcon },
  { to: '/fleet/assignments', label: 'Vehicle Assignments', icon: CalendarIcon },
  { to: '/fleet/bookings', label: 'Bookings & Allocation', icon: BookingsIcon },
  { to: '/fleet/profile', label: 'Profile', icon: ProfileIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/fleet': 'Fleet & Transport Management',
  '/fleet/drivers': 'Driver Roster & Management',
  '/fleet/assignments': 'Vehicle Assignments & Schedules',
  '/fleet/bookings': 'Bookings & Transport Allocation',
  '/fleet/profile': 'Profile Settings',
};

export function FleetLayout() {
  return <SidebarLayout navItems={NAV_ITEMS} pageTitles={PAGE_TITLES} />;
}

