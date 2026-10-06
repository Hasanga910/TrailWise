import { createContext, useContext } from 'react';
import type { CurrentUser } from './types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  user: CurrentUser | null;
  status: AuthStatus;
  error: string | null;
  /** Per-field messages from the last failed login/register, when the API supplied them. */
  fieldErrors?: Record<string, string>;
  /** Forget the last error, e.g. when switching between the login and register pages. */
  clearError?: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, contactNumber: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: CurrentUser) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
