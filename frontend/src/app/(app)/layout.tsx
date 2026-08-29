'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AppNav } from '@/components/app-nav';
import { PageTransition } from '@/components/ui/page-transition';
import { Skeleton } from '@/components/ui/skeleton';

function AppShellSkeleton() {
  return (
    <div className="flex flex-1">
      <div className="w-64 shrink-0 border-r border-white/10 p-4">
        <Skeleton className="mb-6 h-5 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return <AppShellSkeleton />;
  }

  return (
    <div className="flex flex-1">
      <AppNav />
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
