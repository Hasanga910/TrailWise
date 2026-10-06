import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/admin/AdminLayout';
import { OpsLayout } from './components/ops/OpsLayout';
import { TravelerLayout } from './components/traveler/TravelerLayout';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { RequireRole } from './auth/RequireRole';
import { FleetLayout } from './components/fleet/FleetLayout';
import { GuideLayout } from './components/guides/GuideLayout';
import { DriverLayout } from './components/driver/DriverLayout';
import { RoleLayout } from './components/layout/RoleLayout';
import { lazyNamed } from './components/layout/lazyNamed';
import { PageSkeleton } from './components/ui/Skeleton';
import { PublicLayout } from './components/public/PublicLayout';
// The landing page is the entry route for most visitors: bundling it avoids a second round trip before first paint.
import { HomePage } from './pages/HomePage';
import { PortalRedirect } from './pages/PortalRedirect';
import { NotFoundPage } from './pages/NotFoundPage';
import { NoAccessPage } from './pages/NoAccessPage';

const UiGalleryPage = import.meta.env.DEV ? lazyNamed(() => import('./pages/dev/UiGalleryPage'), 'UiGalleryPage') : null;
const ExplorerPage = lazyNamed(() => import('./pages/public/ExplorerPage'), 'ExplorerPage');
const PackageDetailPage = lazyNamed(() => import('./pages/public/PackageDetailPage'), 'PackageDetailPage');
const LoginPage = lazyNamed(() => import('./pages/LoginPage'), 'LoginPage');
const RegisterPage = lazyNamed(() => import('./pages/RegisterPage'), 'RegisterPage');
const AdminOverviewPage = lazyNamed(() => import('./pages/admin/AdminOverviewPage'), 'AdminOverviewPage');
const AdminProfileSettingsPage = lazyNamed(() => import('./pages/admin/AdminProfileSettingsPage'), 'AdminProfileSettingsPage');
const PackageManagementPage = lazyNamed(() => import('./pages/admin/PackageManagementPage'), 'PackageManagementPage');
const PackagesOverviewPage = lazyNamed(() => import('./pages/admin/PackagesOverviewPage'), 'PackagesOverviewPage');
const StaffRolePage = lazyNamed(() => import('./pages/admin/StaffRolePage'), 'StaffRolePage');
const UserManagementIndexPage = lazyNamed(() => import('./pages/admin/UserManagementIndexPage'), 'UserManagementIndexPage');
const OpsApprovalsPage = lazyNamed(() => import('./pages/ops/OpsApprovalsPage'), 'OpsApprovalsPage');
const OpsWorkflowsPage = lazyNamed(() => import('./pages/ops/OpsWorkflowsPage'), 'OpsWorkflowsPage');
const AgentWorkflowPage = lazyNamed(() => import('./pages/ops/AgentWorkflowPage'), 'AgentWorkflowPage');
const OpsBookingsPage = lazyNamed(() => import('./pages/ops/OpsBookingsPage'), 'OpsBookingsPage');
const OpsDashboardPage = lazyNamed(() => import('./pages/ops/OpsDashboardPage'), 'OpsDashboardPage');
const OpsDiscountsPage = lazyNamed(() => import('./pages/ops/OpsDiscountsPage'), 'OpsDiscountsPage');
const OpsPackagesPage = lazyNamed(() => import('./pages/ops/OpsPackagesPage'), 'OpsPackagesPage');
const OpsPaymentsPage = lazyNamed(() => import('./pages/ops/OpsPaymentsPage'), 'OpsPaymentsPage');
const OpsProfileSettingsPage = lazyNamed(() => import('./pages/ops/OpsProfileSettingsPage'), 'OpsProfileSettingsPage');
const OpsReportsPage = lazyNamed(() => import('./pages/ops/OpsReportsPage'), 'OpsReportsPage');
const OpsSupportPage = lazyNamed(() => import('./pages/ops/OpsSupportPage'), 'OpsSupportPage');
const OpsTicketDetailPage = lazyNamed(() => import('./pages/ops/OpsTicketDetailPage'), 'OpsTicketDetailPage');
const BookingRequestPage = lazyNamed(() => import('./pages/traveler/BookingRequestPage'), 'BookingRequestPage');
const MyBookingsPage = lazyNamed(() => import('./pages/traveler/MyBookingsPage'), 'MyBookingsPage');
const PackagesBrowsePage = lazyNamed(() => import('./pages/traveler/PackagesBrowsePage'), 'PackagesBrowsePage');
const FleetOverviewPage = lazyNamed(() => import('./pages/fleet/FleetOverviewPage'), 'FleetOverviewPage');
const FleetProfileSettingsPage = lazyNamed(() => import('./pages/fleet/FleetProfileSettingsPage'), 'FleetProfileSettingsPage');
const FleetDriversPage = lazyNamed(() => import('./pages/fleet/FleetDriversPage'), 'FleetDriversPage');
const FleetVehiclesPage = lazyNamed(() => import('./pages/fleet/FleetVehiclesPage'), 'FleetVehiclesPage');
const FleetAssignmentsPage = lazyNamed(() => import('./pages/fleet/FleetAssignmentsPage'), 'FleetAssignmentsPage');
const TravelerDashboardPage = lazyNamed(() => import('./pages/traveler/TravelerDashboardPage'), 'TravelerDashboardPage');
const TravelerProfileSettingsPage = lazyNamed(() => import('./pages/traveler/TravelerProfileSettingsPage'), 'TravelerProfileSettingsPage');
const GuideAvailabilityPage = lazyNamed(() => import('./pages/guides/GuideAvailabilityPage'), 'GuideAvailabilityPage');
const AssignedToursPage = lazyNamed(() => import('./pages/guides/AssignedToursPage'), 'AssignedToursPage');
const TourDetailPage = lazyNamed(() => import('./pages/guides/TourDetailPage'), 'TourDetailPage');
const GuideProfilePage = lazyNamed(() => import('./pages/guides/GuideProfilePage'), 'GuideProfilePage');
const DriverDashboardPage = lazyNamed(() => import('./pages/driver/DriverDashboardPage'), 'DriverDashboardPage');
const DriverProfileSettingsPage = lazyNamed(() => import('./pages/driver/DriverProfileSettingsPage'), 'DriverProfileSettingsPage');
const GuideDashboardPage = lazyNamed(() => import('./pages/guides/GuideDashboardPage'), 'GuideDashboardPage');

function App() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl p-8">
          <PageSkeleton />
        </div>
      }
    >
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorerPage />} />
        <Route path="/explore/:packageId" element={<PackageDetailPage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/portal"
        element={
          <ProtectedRoute>
            <PortalRedirect />
          </ProtectedRoute>
        }
      />

      <Route
        path="/guides"
        element={
          <RequireRole allowedRoles={['TourGuide']}>
            <GuideLayout />
          </RequireRole>
        }
      >
        <Route index element={<GuideDashboardPage />} />
        <Route path="dashboard" element={<GuideDashboardPage />} />
        <Route path="my-tours" element={<AssignedToursPage />} />
        <Route path="my-tours/:bookingId" element={<TourDetailPage />} />
        <Route path="profile" element={<GuideProfilePage />} />
      </Route>

      {/* Shared page: rendered inside the viewer's own portal shell. */}
      <Route
        path="/guides/availability"
        element={
          <RequireRole allowedRoles={['OperationsManager', 'FleetCoordinator', 'TourGuide']}>
            <RoleLayout />
          </RequireRole>
        }
      >
        <Route index element={<GuideAvailabilityPage />} />
      </Route>

      <Route
        path="/driver"
        element={
          <RequireRole allowedRoles={['Driver']}>
            <DriverLayout />
          </RequireRole>
        }
      >
        <Route path="dashboard" element={<DriverDashboardPage />} />
        <Route path="profile" element={<DriverProfileSettingsPage />} />
      </Route>

      <Route
        path="/traveler"
        element={
          <RequireRole allowedRoles={['Traveler']}>
            <TravelerLayout />
          </RequireRole>
        }
      >
        <Route index element={<TravelerDashboardPage />} />
        <Route path="packages" element={<PackagesBrowsePage />} />
        <Route path="bookings" element={<MyBookingsPage />} />
        <Route path="bookings/new" element={<BookingRequestPage />} />
        <Route path="profile" element={<TravelerProfileSettingsPage />} />
      </Route>

      <Route
        path="/ops"
        element={
          <RequireRole allowedRoles={['OperationsManager', 'Admin']}>
            <OpsLayout />
          </RequireRole>
        }
      >
        <Route index element={<OpsDashboardPage />} />
        <Route path="packages" element={<OpsPackagesPage />} />
        <Route path="discounts" element={<OpsDiscountsPage />} />
        <Route path="payments" element={<OpsPaymentsPage />} />
        <Route path="reports" element={<OpsReportsPage />} />
        <Route path="approvals" element={<OpsApprovalsPage />} />
        <Route path="workflows" element={<OpsWorkflowsPage />} />
        <Route path="bookings" element={<OpsBookingsPage />} />
        <Route path="bookings/:bookingId/workflow" element={<AgentWorkflowPage />} />
        <Route path="support" element={<OpsSupportPage />} />
        <Route path="support/:ticketId" element={<OpsTicketDetailPage />} />
        <Route path="profile" element={<OpsProfileSettingsPage />} />
      </Route>

      <Route
        path="/fleet"
        element={
          <RequireRole allowedRoles={['FleetCoordinator']}>
            <FleetLayout />
          </RequireRole>
        }
      >
        <Route index element={<FleetOverviewPage />} />
        <Route path="vehicles" element={<FleetVehiclesPage />} />
        <Route path="drivers" element={<FleetDriversPage />} />
        <Route path="assignments" element={<FleetAssignmentsPage />} />
        <Route path="profile" element={<FleetProfileSettingsPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireRole allowedRoles={['Admin']}>
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="packages" element={<PackagesOverviewPage />} />
        <Route path="packages/manage" element={<PackageManagementPage />} />
        <Route path="payments" element={<OpsPaymentsPage />} />
        <Route path="support" element={<OpsSupportPage />} />
        <Route path="support/:ticketId" element={<OpsTicketDetailPage />} />
        <Route path="staff" element={<UserManagementIndexPage />} />
        <Route path="staff/tour-guides" element={<StaffRolePage role="TourGuide" roleLabel="Tour Guide" />} />
        <Route
          path="staff/operations-managers"
          element={<StaffRolePage role="OperationsManager" roleLabel="Operations Manager" />}
        />
        <Route
          path="staff/fleet-coordinators"
          element={<StaffRolePage role="FleetCoordinator" roleLabel="Fleet Coordinator" />}
        />
        <Route path="profile" element={<AdminProfileSettingsPage />} />
      </Route>

      {UiGalleryPage && <Route path="/dev/ui" element={<UiGalleryPage />} />}
      <Route path="/no-access" element={<NoAccessPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}

export default App;
