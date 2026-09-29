import { BookingsIcon, DashboardIcon, PackagesIcon, PaymentIcon, ProfileIcon, ReportsIcon, SupportIcon } from '../admin/icons';
import { SidebarLayout, type SidebarNavItem } from '../layout/SidebarLayout';

const NAV_ITEMS: SidebarNavItem[] = [
  { to: '/ops', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/ops/packages', label: 'Packages', icon: PackagesIcon },
  { to: '/ops/payments', label: 'Payment Verification', icon: PaymentIcon },
  { to: '/ops/bookings', label: 'Bookings', icon: BookingsIcon },
  { to: '/ops/support', label: 'Support Tickets', icon: SupportIcon },
  { to: '/ops/reports', label: 'Reports', icon: ReportsIcon },
  { to: '/ops/profile', label: 'Profile', icon: ProfileIcon },
];

const WORKFLOW_ROUTE_PATTERN = /^\/ops\/bookings\/[^/]+\/workflow$/;
const SUPPORT_DETAIL_ROUTE_PATTERN = /^\/ops\/support\/[^/]+$/;

function resolveTitle(pathname: string): string {
  if (pathname === '/ops') {
    return 'Dashboard';
  }
  if (pathname === '/ops/packages') {
    return 'Packages';
  }
  if (pathname === '/ops/payments') {
    return 'Payment Verification';
  }
  if (pathname === '/ops/bookings') {
    return 'Bookings';
  }
  if (pathname === '/ops/support') {
    return 'Support Tickets';
  }
  if (SUPPORT_DETAIL_ROUTE_PATTERN.test(pathname)) {
    return 'Ticket Details';
  }
  if (WORKFLOW_ROUTE_PATTERN.test(pathname)) {
    return 'Agent Workflow';
  }
  if (pathname === '/ops/reports') {
    return 'Operations Reports';
  }
  if (pathname === '/ops/profile') {
    return 'Profile Settings';
  }
  return 'Dashboard';
}

export function OpsLayout() {
  return <SidebarLayout navItems={NAV_ITEMS} pageTitles={resolveTitle} />;
}
