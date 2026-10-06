'use client';

import { RequireRole } from '@/components/require-role';

import { motion } from 'framer-motion';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { VideoStudioWorkspace } from './ai-video-studio-workspace';

export function AiVideoStudioPage() {
  return (
    <RequireRole roles={['OWNER', 'ADMIN', 'MANAGER', 'CREATOR', 'DESIGNER', 'CLIENT', 'SUPER_ADMIN']}>
      <AiVideoStudioPageContent />
    </RequireRole>
  );
}

function AiVideoStudioPageContent() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">AI Video Studio</h1>
        <p className="text-sm text-neutral-400">From idea to ready-to-publish video.</p>
        <p className="mt-2 text-xs text-amber-300/80">
          The stock library is a small fixed catalog. Preview renders a still concept image.
          Export (real video generation) is temporarily disabled while we're between clients —
          it&apos;ll return once there&apos;s revenue to fund the paid rendering tier.
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

          {selectedClientId && <VideoStudioWorkspace key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}
