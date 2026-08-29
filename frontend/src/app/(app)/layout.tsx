'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AppNav } from '@/components/app-nav';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-1">
      <AppNav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
