'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/cn';

function LoadingFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse-slow rounded-full bg-gradient-to-br from-accent-400 via-accent-600 to-accent-800 opacity-70 blur-2xl',
        className,
      )}
    />
  );
}

export const GradientMeshHeroLazy = dynamic(
  () => import('./gradient-mesh-hero').then((m) => m.GradientMeshHero),
  { ssr: false, loading: () => <LoadingFallback /> },
);
