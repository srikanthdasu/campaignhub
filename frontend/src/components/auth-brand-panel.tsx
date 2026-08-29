'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { PlatformOrbit } from '@/components/three/platform-orbit';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

export function AuthBrandPanel({
  eyebrow,
  headline,
  subtext,
}: {
  eyebrow: string;
  headline: string;
  subtext: string;
}) {
  return (
    <div className="relative hidden overflow-y-auto overflow-x-hidden bg-gradient-to-br from-neutral-950 via-accent-950 to-neutral-950 lg:flex lg:flex-col lg:gap-6 lg:p-10">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
      >
        <Image
          src="/brand/logo-full.png"
          alt="CampaignHub AI by Sreema"
          width={1536}
          height={1024}
          priority
          className="h-14 w-auto"
        />
      </motion.div>

      <motion.div variants={staggerContainer(0.08, 0.1)} initial="hidden" animate="show">
        <motion.span
          variants={fadeUp}
          transition={{ duration: DURATION.base, ease: EASE_SOFT }}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-300 backdrop-blur-sm"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
          {eyebrow}
        </motion.span>

        <motion.h1
          variants={fadeUp}
          transition={{ duration: DURATION.base, ease: EASE_SOFT }}
          className="text-balance-pretty mt-3 max-w-md text-3xl font-semibold leading-tight text-white"
        >
          {headline}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          transition={{ duration: DURATION.base, ease: EASE_SOFT }}
          className="mt-3 max-w-sm text-sm leading-relaxed text-white/60"
        >
          {subtext}
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DURATION.slow, ease: EASE_SOFT, delay: 0.2 }}
        className="flex-1"
      >
        <PlatformOrbit />
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_SOFT, delay: 1 }}
          className="mt-2 text-center text-sm font-medium text-white/70"
        >
          Publish everywhere — one click, every platform.
        </motion.p>
      </motion.div>
    </div>
  );
}
