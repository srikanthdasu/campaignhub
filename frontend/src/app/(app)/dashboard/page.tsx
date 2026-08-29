'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { ROLE_LABELS, Role, isAgencyAdmin } from '@/lib/roles';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { GradientMeshHeroLazy } from '@/components/three/gradient-mesh-hero-lazy';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

interface Agency {
  id: string;
  name: string;
  plan: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const admin = isAgencyAdmin(user?.role as Role | undefined);

  const [agency, setAgency] = useState<Agency | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [clientCount, setClientCount] = useState<number | null>(null);

  useEffect(() => {
    api.get<Agency>('/agencies/me').then(setAgency).catch(() => {});
    api
      .get<unknown[]>('/clients')
      .then((c) => setClientCount(c.length))
      .catch(() => {});
    if (admin) {
      api
        .get<unknown[]>('/users')
        .then((u) => setMemberCount(u.length))
        .catch(() => {});
    }
  }, [admin]);

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      <motion.div
        variants={fadeUp}
        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
        className="card-surface relative overflow-hidden rounded-3xl p-8 shadow-lg"
      >
        <div className="absolute -right-4 -top-4 hidden h-64 w-64 sm:block">
          <GradientMeshHeroLazy className="h-full w-full" />
        </div>
        <div className="relative z-10 max-w-xl">
          <p className="text-sm font-medium text-accent-600 dark:text-accent-400">
            {agency?.name ?? 'Your agency'}
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
            Welcome back{user ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            You&apos;re signed in as {user ? ROLE_LABELS[user.role as Role] ?? user.role : '—'}.
            Phase 1 — Auth, RBAC, Agency/Client Setup, Profile, Settings, and Security &amp; Audit
            — is live. Content, scheduling, and AI modules land in later phases.
          </p>
        </div>
      </motion.div>

      <motion.div
        variants={fadeUp}
        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
        className="grid gap-4 sm:grid-cols-3"
      >
        <StatCard label="Clients" value={clientCount} />
        {admin ? (
          <StatCard label="Team members" value={memberCount} />
        ) : (
          <Card padding="lg">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Your role</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
              {user ? ROLE_LABELS[user.role as Role] ?? user.role : '—'}
            </p>
          </Card>
        )}
        <Card padding="lg">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Plan</p>
          <div className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {agency?.plan ?? <Skeleton className="h-7 w-20" />}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card padding="lg" hoverable>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      <div className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
        {value === null ? <Skeleton className="h-9 w-16" /> : <AnimatedNumber value={value} />}
      </div>
    </Card>
  );
}
