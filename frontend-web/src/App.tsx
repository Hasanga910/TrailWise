import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/admin/AdminLayout';
import { GuideLayout } from './components/guide/GuideLayout';
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
import { OpsDashboardPage } from './pages/ops/OpsDashboardPage';
import { OpsPackagesPage } from './pages/ops/OpsPackagesPage';
import { OpsProfileSettingsPage } from './pages/ops/OpsProfileSettingsPage';
import { GuideListPage } from './pages/ops/GuideListPage';
import { CreateGuidePage } from './pages/ops/CreateGuidePage';
import { EditGuidePage } from './pages/ops/EditGuidePage';
import { OpsItineraryPage } from './pages/ops/OpsItineraryPage';
import { BookingRequestPage } from './pages/traveler/BookingRequestPage';
import { MyBookingsPage } from './pages/traveler/MyBookingsPage';
import { PackagesBrowsePage } from './pages/traveler/PackagesBrowsePage';
import { TravelerDashboardPage } from './pages/traveler/TravelerDashboardPage';
import { TravelerProfileSettingsPage } from './pages/traveler/TravelerProfileSettingsPage';
import { GuideAvailabilityPage } from './pages/guides/GuideAvailabilityPage';
import { AssignedToursPage } from './pages/guide/AssignedToursPage';
import { AssignedTourDetailPage } from './pages/guide/AssignedTourDetailPage';
import { TourItineraryPage } from './pages/guide/TourItineraryPage';

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
          <RequireRole allowedRoles={['OperationsManager', 'FleetCoordinator', 'TourGuide', 'Admin']}>
            <GuideAvailabilityPage />
          </RequireRole>
        }
      />

      {/* Tour Guide Portal */}
      <Route
        path="/guide"
        element={
          <RequireRole allowedRoles={['TourGuide']}>
            <GuideLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="tours" replace />} />
        <Route path="tours" element={<AssignedToursPage />} />
        <Route path="tours/:id" element={<AssignedTourDetailPage />} />
        <Route path="tours/:id/itinerary" element={<TourItineraryPage />} />
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
          <RequireRole allowedRoles={['OperationsManager']}>
            <OpsLayout />
          </RequireRole>
        }
      >
        <Route index element={<OpsDashboardPage />} />
        <Route path="packages" element={<OpsPackagesPage />} />
        <Route path="guides" element={<GuideListPage basePath="/ops/guides" />} />
        <Route path="guides/new" element={<CreateGuidePage basePath="/ops/guides" />} />
        <Route path="guides/:id/edit" element={<EditGuidePage basePath="/ops/guides" />} />
        <Route path="itineraries" element={<OpsItineraryPage />} />
        <Route path="profile" element={<OpsProfileSettingsPage />} />
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
        <Route path="guides" element={<GuideListPage basePath="/admin/guides" />} />
        <Route path="guides/new" element={<CreateGuidePage basePath="/admin/guides" />} />
        <Route path="guides/:id/edit" element={<EditGuidePage basePath="/admin/guides" />} />
        <Route path="itineraries" element={<OpsItineraryPage />} />
        <Route path="profile" element={<AdminProfileSettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
