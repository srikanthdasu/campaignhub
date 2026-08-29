'use client';

import { motion } from 'framer-motion';
import { DURATION, EASE_SOFT } from '@/lib/motion';

// Sits below the sign-in/sign-up card, in the space that would otherwise be empty on tall
// screens — real, already-built capabilities only (no fabricated stats/social proof).
const FEATURES = ['Role-based access', 'Real-time approvals', 'AI content tools', 'Multi-client workspace'];

export function AuthPromoFooter() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE_SOFT, delay: 0.4 }}
      className="flex w-full max-w-sm flex-col items-center gap-2 pt-6 text-center"
    >
      <p className="gradient-text text-base font-semibold sm:text-lg">
        Plan it. Approve it. Publish it. All in one place.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {FEATURES.map((f, i) => (
          <span key={f} className="flex items-center gap-3 text-xs text-neutral-500">
            {i > 0 && <span className="h-1 w-1 rounded-full bg-neutral-700" />}
            {f}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
