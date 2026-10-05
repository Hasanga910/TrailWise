import { useEffect } from 'react';
import { useApprovalsStore, selectPendingTotal } from '../../stores/approvalsStore';
import { WorkflowsIcon, ApprovalsIcon, BookingsIcon, CalendarIcon, DashboardIcon, PackagesIcon, PaymentIcon, ProfileIcon, ReportsIcon, SupportIcon, TagIcon } from '../admin/icons';
import { AppShell, type SidebarNavItem } from '../layout/AppShell';

const BASE_NAV_ITEMS: SidebarNavItem[] = [
  { to: '/ops', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/ops/packages', label: 'Packages', icon: PackagesIcon, section: 'Catalogue' },
  { to: '/ops/discounts', label: 'Discounts', icon: TagIcon },
  { to: '/ops/payments', label: 'Payment Verification', icon: PaymentIcon },
  { to: '/ops/approvals', label: 'Approvals', icon: ApprovalsIcon, section: 'Operations' },
  { to: '/ops/workflows', label: 'Agent Workflows', icon: WorkflowsIcon },
  { to: '/ops/bookings', label: 'Bookings', icon: BookingsIcon },
  { to: '/ops/support', label: 'Support Tickets', icon: SupportIcon },
  { to: '/ops/reports', label: 'Reports', icon: ReportsIcon, section: 'Insights' },
  { to: '/guides/availability', label: 'Guide Availability', icon: CalendarIcon },
  { to: '/ops/profile', label: 'Profile', icon: ProfileIcon, section: 'Account' },
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
  if (pathname === '/ops/discounts') {
    return 'Discounts';
  }
  if (pathname === '/ops/payments') {
    return 'Payment Verification';
  }
  if (pathname === '/ops/approvals') {
    return 'Approval Queue';
  }
  if (pathname === '/ops/workflows') {
    return 'Agent Workflows';
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
  if (pathname === '/guides/availability') {
    return 'Guide Availability';
  }
  if (pathname === '/ops/profile') {
    return 'Profile Settings';
  }
  return 'Dashboard';
}

export function OpsLayout() {
  const pending = useApprovalsStore(selectPendingTotal);
  const fetchPending = useApprovalsStore((s) => s.fetchPending);
  const loaded = useApprovalsStore((s) => s.loaded);
  const reset = useApprovalsStore((s) => s.reset);

  // The navigation badge needs the count on every Ops page, not only on the queue.
  useEffect(() => {
    if (!loaded && !useApprovalsStore.getState().loading) void fetchPending();
  }, [loaded, fetchPending]);

  // Leaving the Ops area clears the queue so another account never sees it.
  useEffect(() => reset, [reset]);

  const navItems = BASE_NAV_ITEMS.map((item) => (item.to === '/ops/approvals' ? { ...item, badge: pending } : item));
  return <AppShell navItems={navItems} pageTitles={resolveTitle} portalLabel="Operations Portal" />;
}
