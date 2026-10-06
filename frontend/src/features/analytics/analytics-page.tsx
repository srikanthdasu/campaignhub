'use client';

import { motion } from 'framer-motion';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { AnalyticsOverview } from './analytics-workspace';

export function AnalyticsPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Analytics</h1>
        <p className="text-sm text-neutral-400">Collect. Analyze. Understand. Optimize.</p>
        <p className="mt-2 text-xs text-amber-300/80">
          Reach, impressions, and engagement need a connected platform analytics API — not
          available since Social Accounts are added manually (Phase 3). Every number below is a
          real count from CampaignHub&apos;s own data, not a platform metric.
        </p>
      </motion.div>

      {clients === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">No clients yet — create one from Agency &amp; Clients first.</p>
        </Card>
      ) : (
        <>
          {clients && (
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <ClientPicker clients={clients} value={selectedClientId} onChange={setSelectedClientId} />
            </motion.div>
          )}

          {selectedClientId && <AnalyticsOverview key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}
