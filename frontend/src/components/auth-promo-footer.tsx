'use client';

import { motion } from 'framer-motion';
import { DURATION, EASE_SOFT } from '@/lib/motion';

// Fills whatever vertical space is left below the hero/form grid instead of leaving it blank —
// grows via flex-1 so it absorbs exactly the leftover room on any screen height rather than
// adding fixed height on top of already-fitted content. Real, built capabilities only (no
// fabricated stats/social proof) — matches the "no free space, but nothing fake either" brief.
const FEATURES = ['Role-based access', 'Real-time approvals', 'AI content tools', 'Multi-client workspace'];

export function AuthPromoFooter() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE_SOFT, delay: 0.4 }}
      className="flex flex-1 flex-col items-center justify-center gap-1 border-t border-white/10 px-6 py-1 text-center"
    >
      <p className="gradient-text text-sm font-semibold sm:text-base">
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
