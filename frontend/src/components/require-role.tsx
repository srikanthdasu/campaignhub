'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Role } from '@/lib/roles';

// AppShell already guarantees `status === 'authenticated'` with a real `user` by the time any
// page under (app) renders — this only adds the ROLE check, and only as real navigation
// enforcement (redirect + no render), not just a hidden nav link. Backend guards remain the
// real authorization boundary; this is defense-in-depth so a disallowed role can't just type the
// URL and see the page render even for a moment.
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = !!user && roles.includes(user.role as Role);

  useEffect(() => {
    if (user && !allowed) {
      router.replace(user.role === 'CLIENT' ? '/client-portal' : '/dashboard');
    }
  }, [user, allowed, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
