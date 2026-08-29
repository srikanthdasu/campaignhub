'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, ApiError, AuthUser, setAccessToken, subscribeToTokenChanges } from '@/lib/api';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: AuthUser | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  register: (agencyName: string, name: string, email: string, password: string) => Promise<void>;
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

  const register = useCallback(
    async (agencyName: string, name: string, email: string, password: string) => {
      const res = await api.post<{ user: AuthUser; accessToken: string }>('/auth/register', {
        agencyName,
        name,
        email,
        password,
      });
      setAccessToken(res.accessToken);
      setUser(res.user);
      setStatus('authenticated');
    },
    [],
  );

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
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
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
