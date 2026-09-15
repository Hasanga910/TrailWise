import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { RequireRole } from './auth/RequireRole';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ManagePackagesPage } from './pages/ManagePackagesPage';
import { RegisterPage } from './pages/RegisterPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manage/packages"
        element={
          <RequireRole allowedRoles={['OperationsManager', 'Admin']}>
            <ManagePackagesPage />
          </RequireRole>
        }
      />
    </Routes>
  );
}

export default App;
