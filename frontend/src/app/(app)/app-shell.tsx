'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { AppNav } from '@/components/app-nav';
import { NotificationBell } from '@/components/notification-bell';
import { PageTransition } from '@/components/ui/page-transition';
import { Skeleton } from '@/components/ui/skeleton';

function AppShellSkeleton() {
  return (
    <div className="flex flex-1">
      <div className="hidden w-64 shrink-0 border-r border-white/10 p-4 lg:block">
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

export function AppShell({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return <AppShellSkeleton />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}
      <AppNav isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-3 lg:justify-end lg:px-10">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="Open menu"
            className="text-neutral-300 hover:text-neutral-50 lg:hidden"
          >
            <Menu className="h-6 w-6" strokeWidth={2} />
          </button>
          <NotificationBell />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-10">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
