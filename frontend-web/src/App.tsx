import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/admin/AdminLayout';
import { OpsLayout } from './components/ops/OpsLayout';
import { TravelerLayout } from './components/traveler/TravelerLayout';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { RequireRole } from './auth/RequireRole';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { PortalFallbackPage } from './pages/PortalFallbackPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminProfileSettingsPage } from './pages/admin/AdminProfileSettingsPage';
import { PackageManagementPage } from './pages/admin/PackageManagementPage';
import { PackagesOverviewPage } from './pages/admin/PackagesOverviewPage';
import { StaffRolePage } from './pages/admin/StaffRolePage';
import { UserManagementIndexPage } from './pages/admin/UserManagementIndexPage';
import { AgentWorkflowPage } from './pages/ops/AgentWorkflowPage';
import { OpsBookingsPage } from './pages/ops/OpsBookingsPage';
import { OpsDashboardPage } from './pages/ops/OpsDashboardPage';
import { OpsDiscountsPage } from './pages/ops/OpsDiscountsPage';
import { OpsPackagesPage } from './pages/ops/OpsPackagesPage';
import { OpsPaymentsPage } from './pages/ops/OpsPaymentsPage';
import { OpsProfileSettingsPage } from './pages/ops/OpsProfileSettingsPage';
import { OpsReportsPage } from './pages/ops/OpsReportsPage';
import { OpsSupportPage } from './pages/ops/OpsSupportPage';
import { OpsTicketDetailPage } from './pages/ops/OpsTicketDetailPage';
import { BookingRequestPage } from './pages/traveler/BookingRequestPage';
import { MyBookingsPage } from './pages/traveler/MyBookingsPage';
import { PackagesBrowsePage } from './pages/traveler/PackagesBrowsePage';
import { FleetLayout } from './components/fleet/FleetLayout';
import { FleetOverviewPage } from './pages/fleet/FleetOverviewPage';
import { FleetProfileSettingsPage } from './pages/fleet/FleetProfileSettingsPage';
import { FleetDriversPage } from './pages/fleet/FleetDriversPage';
import { FleetVehiclesPage } from './pages/fleet/FleetVehiclesPage';
import { FleetAssignmentsPage } from './pages/fleet/FleetAssignmentsPage';
import { TravelerDashboardPage } from './pages/traveler/TravelerDashboardPage';
import { TravelerProfileSettingsPage } from './pages/traveler/TravelerProfileSettingsPage';
import { GuideAvailabilityPage } from './pages/guides/GuideAvailabilityPage';
import { AssignedToursPage } from './pages/guides/AssignedToursPage';
import { TourDetailPage } from './pages/guides/TourDetailPage';
import { GuideProfilePage } from './pages/guides/GuideProfilePage';
import { DriverDashboardPage } from './pages/driver/DriverDashboardPage';
import { DriverProfileSettingsPage } from './pages/driver/DriverProfileSettingsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/portal"
        element={
          <ProtectedRoute>
            <PortalFallbackPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/guides/availability"
        element={
          <RequireRole allowedRoles={['OperationsManager', 'FleetCoordinator', 'TourGuide']}>
            <GuideAvailabilityPage />
          </RequireRole>
        }
      />

      <Route
        path="/guides/my-tours"
        element={
          <RequireRole allowedRoles={['TourGuide']}>
            <AssignedToursPage />
          </RequireRole>
        }
      />

      <Route
        path="/guides/my-tours/:bookingId"
        element={
          <RequireRole allowedRoles={['TourGuide']}>
            <TourDetailPage />
          </RequireRole>
        }
      />

      <Route
        path="/guides/profile"
        element={
          <RequireRole allowedRoles={['TourGuide']}>
            <GuideProfilePage />
          </RequireRole>
        }
      />

      <Route
        path="/driver/dashboard"
        element={
          <RequireRole allowedRoles={['Driver', 'FleetCoordinator', 'Admin']}>
            <DriverDashboardPage />
          </RequireRole>
        }
      />

      <Route
        path="/driver/profile"
        element={
          <RequireRole allowedRoles={['Driver', 'FleetCoordinator', 'Admin']}>
            <DriverProfileSettingsPage />
          </RequireRole>
        }
      />

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
        <Route
          path="staff/drivers"
          element={<StaffRolePage role="Driver" roleLabel="Driver" />}
        />
        <Route path="profile" element={<AdminProfileSettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
