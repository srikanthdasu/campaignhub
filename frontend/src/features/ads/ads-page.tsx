'use client';

import { RequireRole } from '@/components/require-role';

import { motion } from 'framer-motion';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { AdsWorkspace } from './ads-workspace';

export function AdsPage() {
  return (
    <RequireRole roles={['OWNER', 'ADMIN', 'MANAGER', 'CREATOR', 'DESIGNER', 'SUPER_ADMIN']}>
      <AdsPageContent />
    </RequireRole>
  );
}

function AdsPageContent() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Ads &amp; Paid Campaigns</h1>
        <p className="text-sm text-neutral-400">
          Paid campaigns launch only after budget, permission, and platform validation.
        </p>
        <p className="mt-2 text-xs text-amber-300/80">
          No Meta / Google / TikTok Ads API credentials are configured yet, so Launch marks the
          record launched rather than placing a real paid ad buy — the Approval gate itself is
          fully enforced regardless.
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

          {selectedClientId && <AdsWorkspace key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}
