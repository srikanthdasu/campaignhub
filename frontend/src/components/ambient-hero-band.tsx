'use client';

import { motion } from 'framer-motion';
import { SocialConstellation } from '@/components/social-constellation';
import { DURATION, EASE_SOFT, fadeUp } from '@/lib/motion';

// The persistent, ambient version of the auth pages' hero — present on every app screen per
// the product direction, but deliberately smaller and metric-free: a working screen shouldn't
// compete with fabricated-looking stat chips (the Analytics page right below it has the real
// numbers), so this only carries brand motion + the platform constellation, not claims.
export function AmbientHeroBand() {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ duration: DURATION.base, ease: EASE_SOFT }}
      className="card-surface relative mb-6 flex items-center gap-6 overflow-hidden rounded-2xl px-6 py-3"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 70% 100% at 80% 50%, black 30%, transparent 85%)',
        }}
      />

      <div className="relative z-10 min-w-0 flex-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          <span className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-accent-400" />
          Live workspace
        </span>
        <p className="mt-1.5 truncate text-sm font-medium text-neutral-300">
          Every platform, one connected workspace.
        </p>
      </div>

      <div className="relative z-10 shrink-0">
        <SocialConstellation size="sm" />
      </div>
    </motion.div>
  );
}
