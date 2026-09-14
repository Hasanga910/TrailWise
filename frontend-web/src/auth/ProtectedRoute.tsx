import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Logo } from '../components/Logo';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Logo className="h-8 w-auto" />
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
          <p className="text-sm font-medium text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
