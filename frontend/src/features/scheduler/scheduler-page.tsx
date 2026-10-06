'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useClientPicker } from '@/hooks/use-client-picker';
import { Card } from '@/components/ui/card';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { SchedulerWorkspace } from './scheduler-workspace';

export function SchedulerPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const searchParams = useSearchParams();
  const mediaParam = searchParams.get('media');

  // Deep-linked from AI Image Studio's "Schedule It" — ?client=<id>&media=<id> lands here with
  // the client selected; mediaParam flows down to prefill the "Create New" draft form below.
  useEffect(() => {
    const clientParam = searchParams.get('client');
    if (clientParam) setSelectedClientId(clientParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="max-w-[1500px] space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Scheduler</h1>
        <p className="text-sm text-neutral-400">From content creation to automatic publishing.</p>
        <p className="mt-1 text-xs text-amber-300/80">
          Bulk CSV scheduling, repeat/recurring posts, and AI &quot;best time to post&quot;
          suggestions aren&apos;t built yet. Estimated reach/engagement isn&apos;t shown — that
          needs a connected analytics provider. Real one-click publishing works for Instagram
          today; every other platform still simulates the &quot;Published&quot; status.
        </p>
      </motion.div>

      {clients && clients.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">No clients yet — create one from Agency &amp; Clients first.</p>
        </Card>
      ) : (
        <>
          {selectedClientId && (
            <SchedulerWorkspace
              key={selectedClientId}
              clientId={selectedClientId}
              clients={clients ?? []}
              selectedClientId={selectedClientId}
              setSelectedClientId={setSelectedClientId}
              prefillMediaAssetId={mediaParam}
            />
          )}
        </>
      )}
    </motion.div>
  );
}
