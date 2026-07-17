import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, UserRole } from '../types/User';
import { loginUser, getCurrentUser } from '../api/authApi';
import { setToken, getToken, clearToken, isExpired } from '../api/tokenManager';
import { ApiRequestError } from '../api/apiError';

interface AuthContextValue {
  currentUser: User | null;
  isInitializing: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // On mount: restore session from localStorage
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const token = getToken();
        if (!token || isExpired()) {
          clearToken();
          return;
        }
        const dto = await getCurrentUser();
        if (cancelled) return;
        setCurrentUser({
          id: dto.id,
          fullName: dto.fullName,
          email: dto.email,
          role: dto.role as UserRole,
          phone: dto.phone,
        });
      } catch {
        clearToken();
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  // Listen for 401 events emitted by apiClient
  useEffect(() => {
    function handleUnauthorized() {
      clearToken();
      setCurrentUser(null);
      navigate('/login', { replace: true });
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await loginUser(email, password);
    setToken(response.accessToken, response.expiresIn);
    setCurrentUser({
      id: response.user.id,
      fullName: response.user.fullName,
      email: response.user.email,
      role: response.user.role as UserRole,
      phone: response.user.phone,
    });
    // Navigation is handled by the caller (LoginPage) so it can honor the saved location
  }, []);

  const logout = useCallback((): void => {
    clearToken();
    setCurrentUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({ currentUser, isInitializing, login, logout }),
    [currentUser, isInitializing, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Export ApiRequestError so features can catch it
export { ApiRequestError };
