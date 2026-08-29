'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
}

const ACTION_TONE: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  LOGIN_SUCCESS: 'success',
  LOGIN_FAILED: 'danger',
  MEMBER_DEACTIVATED: 'warning',
  MEMBER_ACTIVATED: 'success',
  MEMBER_ROLE_CHANGED: 'accent',
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AuditEntry[]>('/audit-logs')
      .then(setEntries)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load audit log');
        setEntries([]);
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
        <h1 className="text-2xl font-semibold text-neutral-50">Security &amp; audit</h1>
        <p className="text-sm text-neutral-400">
          Recent security-relevant activity across your agency.
        </p>
      </motion.div>

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        {entries === null ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Card padding="lg">
            <p className="text-sm text-neutral-400">No activity yet.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {entries.map((entry) => (
                <motion.li
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: DURATION.fast, ease: EASE_SOFT }}
                >
                  <Card padding="md" className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={ACTION_TONE[entry.action] ?? 'neutral'}>{entry.action}</Badge>
                        {entry.entityType && (
                          <span className="text-xs text-neutral-400">{entry.entityType}</span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-xs text-neutral-400">
                        {entry.user ? `${entry.user.name} (${entry.user.email})` : 'System'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </Card>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </motion.div>
    </motion.div>
  );
}
