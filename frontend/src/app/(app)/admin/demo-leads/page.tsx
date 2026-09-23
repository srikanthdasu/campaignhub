'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { RequireRole } from '@/components/require-role';

interface DemoLead {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface DemoLeadsResponse {
  items: DemoLead[];
  total: number;
}

export default function DemoLeadsPage() {
  return (
    <RequireRole roles={['OWNER', 'ADMIN', 'SUPER_ADMIN']}>
      <DemoLeadsPageContent />
    </RequireRole>
  );
}

function DemoLeadsPageContent() {
  const [leads, setLeads] = useState<DemoLead[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DemoLeadsResponse>('/demo-leads')
      .then((res) => {
        setLeads(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load demo leads');
        setLeads([]);
      });
  }, []);

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-3xl space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Demo leads</h1>
        <p className="text-sm text-neutral-400">
          Everyone who has introduced themselves through the shared demo login
          {total > 0 && ` — ${total} so far`}.
        </p>
      </motion.div>

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        {leads === null ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <Card padding="lg">
            <p className="text-sm text-neutral-400">No one has introduced themselves yet.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Card padding="md" className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-50">{lead.name}</p>
                    <p className="truncate text-xs text-neutral-400">{lead.email}</p>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {new Date(lead.createdAt).toLocaleString()}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>
  );
}
