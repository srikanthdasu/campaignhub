'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, ApiError, AuthUser, setAccessToken, subscribeToTokenChanges } from '@/lib/api';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: AuthUser | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (agencyName: string, name: string, email: string, password: string) => Promise<{ message: string }>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<{ message: string }>;
  switchAgency: (agencyId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    // Catches session expiry discovered mid-session (a background silent-refresh
    // failing inside api.ts) as well as the explicit logout() call below.
    subscribeToTokenChanges((token) => {
      if (token === null) {
        setUser(null);
        setStatus('unauthenticated');
      }
    });

    api
      .refreshSession()
      .then((session) => {
        if (session) {
          setUser(session.user);
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      })
      .catch(() => setStatus('unauthenticated'));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: AuthUser; accessToken: string }>('/auth/login', {
      email,
      password,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const res = await api.post<{ user: AuthUser; accessToken: string }>('/auth/google', { idToken });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(
    async (agencyName: string, name: string, email: string, password: string) => {
      return api.post<{ message: string }>('/auth/register', {
        agencyName,
        name,
        email,
        password,
      });
    },
    [],
  );

  const verifyEmail = useCallback(async (token: string) => {
    const res = await api.post<{ user: AuthUser; accessToken: string }>('/auth/verify-email', {
      token,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    return api.post<{ message: string }>('/auth/resend-verification', { email });
  }, []);

  const switchAgency = useCallback(async (agencyId: string) => {
    // The backend endpoint only updates the account's own agencyId + logs it — it deliberately
    // doesn't reissue tokens itself (that logic already exists correctly in /auth/refresh, which
    // re-reads this account's current DB row including the field we just changed).
    await api.patch('/users/me/act-as-agency', { agencyId });
    const session = await api.refreshSession();
    if (session) {
      setUser(session.user);
      setStatus('authenticated');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // best-effort — clear local state regardless
    }
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, status, login, loginWithGoogle, register, verifyEmail, resendVerification, switchAgency, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { ApiError };
