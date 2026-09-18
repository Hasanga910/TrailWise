import { BookingsIcon, DashboardIcon, PackagesIcon, ProfileIcon } from '../admin/icons';
import { SidebarLayout, type SidebarNavItem } from '../layout/SidebarLayout';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/traveler', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/traveler/packages', label: 'Browse Packages', icon: PackagesIcon },
  { to: '/traveler/bookings', label: 'My Bookings', icon: BookingsIcon },
  { to: '/traveler/profile', label: 'Profile', icon: ProfileIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/traveler': 'Dashboard',
  '/traveler/packages': 'Browse Packages',
  '/traveler/bookings': 'My Bookings',
  '/traveler/bookings/new': 'Request a Booking',
  '/traveler/profile': 'Profile Settings',
};

export function TravelerLayout() {
  return <SidebarLayout navItems={NAV_ITEMS} pageTitles={PAGE_TITLES} />;
}
