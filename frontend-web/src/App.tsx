import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/admin/AdminLayout';
import { OpsLayout } from './components/ops/OpsLayout';
import { TravelerLayout } from './components/traveler/TravelerLayout';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { RequireRole } from './auth/RequireRole';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { PortalFallbackPage } from './pages/PortalFallbackPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { PackageManagementPage } from './pages/admin/PackageManagementPage';
import { PackagesOverviewPage } from './pages/admin/PackagesOverviewPage';
import { StaffRolePage } from './pages/admin/StaffRolePage';
import { UserManagementIndexPage } from './pages/admin/UserManagementIndexPage';
import { OpsDashboardPage } from './pages/ops/OpsDashboardPage';
import { OpsPackagesPage } from './pages/ops/OpsPackagesPage';
import { TravelerDashboardPage } from './pages/traveler/TravelerDashboardPage';

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
        path="/traveler"
        element={
          <RequireRole allowedRoles={['Traveler']}>
            <TravelerLayout />
          </RequireRole>
        }
      >
        <Route index element={<TravelerDashboardPage />} />
        <Route path="profile" element={<ProfileSettingsPage />} />
      </Route>

      <Route
        path="/ops"
        element={
          <RequireRole allowedRoles={['OperationsManager']}>
            <OpsLayout />
          </RequireRole>
        }
      >
        <Route index element={<OpsDashboardPage />} />
        <Route path="packages" element={<OpsPackagesPage />} />
        <Route path="profile" element={<ProfileSettingsPage />} />
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
        <Route path="profile" element={<ProfileSettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
