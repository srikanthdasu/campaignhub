'use client';

import { RequireRole } from '@/components/require-role';

import { motion } from 'framer-motion';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { StrategyWorkspace } from './ai-strategy-workspace';

export function AiStrategyPage() {
  return (
    <RequireRole roles={['OWNER', 'ADMIN', 'MANAGER', 'CREATOR', 'DESIGNER', 'SUPER_ADMIN']}>
      <AiStrategyPageContent />
    </RequireRole>
  );
}

function AiStrategyPageContent() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">AI Strategy &amp; Governance</h1>
        <p className="text-sm text-neutral-400">
          AI uses permitted context, produces traceable outputs, and improves through measured
          feedback.
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

          {selectedClientId && <StrategyWorkspace key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}
