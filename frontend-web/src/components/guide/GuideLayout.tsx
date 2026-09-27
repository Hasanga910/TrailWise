import { BookingsIcon, CalendarIcon } from '../admin/icons';
import { SidebarLayout, type SidebarNavItem } from '../layout/SidebarLayout';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/guide/tours', label: 'My Assigned Tours', icon: BookingsIcon },
  { to: '/guides/availability', label: 'My Availability', icon: CalendarIcon },
];

const PAGE_TITLES: Record<string, string> = {
  '/guide': 'My Assigned Tours',
  '/guide/tours': 'My Assigned Tours',
  '/guides/availability': 'My Availability',
};

export function GuideLayout() {
  return <SidebarLayout navItems={NAV_ITEMS} pageTitles={PAGE_TITLES} />;
}
