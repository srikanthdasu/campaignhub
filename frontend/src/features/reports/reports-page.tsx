'use client';

import { motion } from 'framer-motion';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { ReportList } from './reports-workspace';

export function ReportsPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="max-w-3xl space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Reports</h1>
        <p className="text-sm text-neutral-400">From data to decisions. Create. Customize. Share.</p>
        <p className="mt-2 text-xs text-amber-300/80">
          Exports are CSV today (opens in Excel/Sheets) — PDF and PPT exports need a rendering
          pipeline not built in this pass. Every row is pulled live from CampaignHub&apos;s data.
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

          {selectedClientId && <ReportList key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}
