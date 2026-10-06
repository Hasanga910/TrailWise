import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getHomeRouteForRole } from '../auth/roleHome';

/** Legacy `/portal` entry point: send each role to its real home. */
export function PortalRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'TourGuide' ? '/guides' : getHomeRouteForRole(user.role)} replace />;
}
