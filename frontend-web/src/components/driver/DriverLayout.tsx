import { CalendarIcon, ProfileIcon } from '../admin/icons';
import { AppShell, type SidebarNavItem } from '../layout/AppShell';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/driver/dashboard', label: 'My Trips', icon: CalendarIcon },
  { to: '/driver/profile', label: 'Profile', icon: ProfileIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/driver/dashboard': 'My Trips',
  '/driver/profile': 'Profile Settings',
};

export function DriverLayout() {
  return <AppShell navItems={NAV_ITEMS} pageTitles={PAGE_TITLES} portalLabel="Driver Portal" />;
}
