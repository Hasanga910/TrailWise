import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import type { UserRole } from './types';

export function RequireRole({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      {user && allowedRoles.includes(user.role) ? <>{children}</> : <Navigate to="/dashboard" replace />}
    </ProtectedRoute>
  );
}
