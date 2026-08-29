'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { SocialConstellation } from '@/components/social-constellation';
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
    <div className="relative hidden overflow-y-auto overflow-x-hidden bg-gradient-to-br from-neutral-950 via-accent-900 to-neutral-950 lg:flex lg:flex-col lg:gap-6 lg:p-10">
      {/* Ambient depth: soft glows + a faint dot grid, so the panel reads as a "scene" rather than a flat fill */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 90%)',
        }}
      />
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-accent-500/25 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-[110px]" />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
        className="relative z-10"
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

      <motion.div variants={staggerContainer(0.08, 0.1)} initial="hidden" animate="show" className="relative z-10">
        <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }} className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-300 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-accent-400" />
            {eyebrow}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 backdrop-blur-sm">
            Interactive workspace
          </span>
        </motion.div>

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
        className="relative z-10 flex flex-1 flex-col items-center justify-center"
      >
        <SocialConstellation size="lg" showStats hint />
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_SOFT, delay: 1 }}
          className="mt-6 text-center text-sm font-medium text-white/70"
        >
          Publish everywhere — one click, every platform.
        </motion.p>
      </motion.div>
    </div>
  );
}
