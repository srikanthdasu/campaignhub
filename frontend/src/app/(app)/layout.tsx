import { ReactNode } from 'react';
import { AppShell } from './app-shell';

// Every page in this tree is a per-user authenticated dashboard fetching live data
// client-side — there's no correct static shell to cache. Without this, Next statically
// prerenders the shell once and keeps serving that snapshot indefinitely across deploys
// (the running Azure worker doesn't always recycle on redeploy), so users can be stuck
// looking at yesterday's build until something else busts the cache.
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
