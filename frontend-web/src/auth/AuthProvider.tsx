import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, extractErrorMessage, setAuthToken, setSessionExpiredHandler } from '../api/apiClient';
import { AuthContext, type AuthStatus } from './AuthContext';
import type { AuthResponse, CurrentUser } from './types';

const STORAGE_KEY = 'trailwise_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    localStorage.getItem(STORAGE_KEY) ? 'loading' : 'unauthenticated',
  );
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(logout);
    return () => setSessionExpiredHandler(null);
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      return;
    }

    setAuthToken(token);
    apiClient
      .get<CurrentUser>('/api/auth/me')
      .then((response) => {
        setUser(response.data);
        setStatus('authenticated');
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setAuthToken(null);
        setStatus('unauthenticated');
      });
  }, []);

  const applyAuthResponse = useCallback((data: AuthResponse) => {
    localStorage.setItem(STORAGE_KEY, data.token);
    setAuthToken(data.token);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const response = await apiClient.post<AuthResponse>('/api/auth/login', { email, password });
        applyAuthResponse(response.data);
        return true;
      } catch (err) {
        setError(extractErrorMessage(err, 'Login failed. Please try again.'));
        return false;
      }
    },
    [applyAuthResponse],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setError(null);
      try {
        const response = await apiClient.post<AuthResponse>('/api/auth/register', {
          name,
          email,
          password,
        });
        applyAuthResponse(response.data);
        return true;
      } catch (err) {
        setError(extractErrorMessage(err, 'Registration failed. Please try again.'));
        return false;
      }
    },
    [applyAuthResponse],
  );

  const value = useMemo(
    () => ({ user, status, error, login, register, logout }),
    [user, status, error, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
