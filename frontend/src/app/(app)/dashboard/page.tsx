'use client';

import { useAuth } from '@/contexts/auth-context';
import { ROLE_LABELS, Role } from '@/lib/roles';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Welcome{user ? `, ${user.name}` : ''}</h1>
      <p className="text-sm text-neutral-500">
        You&apos;re signed in as {user ? ROLE_LABELS[user.role as Role] ?? user.role : '—'}.
        Phase 1 (Auth, RBAC, Agency/Client Setup, Profile, Settings, Security &amp; Audit) is live
        — the content, scheduling, and AI modules land in later phases.
      </p>
    </div>
  );
}
