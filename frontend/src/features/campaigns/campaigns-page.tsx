'use client';

import { motion } from 'framer-motion';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { CampaignsWorkspace } from './campaigns-workspace';

export function CampaignsPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="max-w-[1500px] space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Campaigns</h1>
        <p className="text-sm text-neutral-400">From campaign creation to performance tracking.</p>
        <p className="mt-1 text-xs text-amber-300/80">
          Reach, engagement, and ROI numbers aren&apos;t shown here — those need a connected
          analytics provider that doesn&apos;t exist yet. Everything below (goals, platforms,
          content ideas, approvals, linked content) is real and saved.
        </p>
      </motion.div>

      {clients && clients.length === 0 ? (
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

          {selectedClientId && <CampaignsWorkspace key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}
