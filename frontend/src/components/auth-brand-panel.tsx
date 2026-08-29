'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ShieldCheck, Building2, Activity, type LucideIcon } from 'lucide-react';
import { GradientMeshHeroLazy } from '@/components/three/gradient-mesh-hero-lazy';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: ShieldCheck,
    title: 'Role-based access',
    description: 'Seven roles, granular permissions, enforced server-side.',
  },
  {
    icon: Building2,
    title: 'Multi-client workspace',
    description: 'Manage every client and teammate from one agency hub.',
  },
  {
    icon: Activity,
    title: 'Full audit trail',
    description: 'Every sensitive action logged, visible, accountable.',
  },
];

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
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-neutral-950 via-accent-950 to-neutral-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="absolute inset-0 -z-0 flex items-center justify-center opacity-70">
        <GradientMeshHeroLazy className="h-[26rem] w-[26rem]" />
      </div>

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
          className="h-16 w-auto"
        />
      </motion.div>

      <motion.div
        variants={staggerContainer(0.08, 0.1)}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-md"
      >
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
          className="text-balance-pretty mt-4 text-4xl font-semibold leading-tight text-white"
        >
          {headline}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          transition={{ duration: DURATION.base, ease: EASE_SOFT }}
          className="mt-4 text-sm leading-relaxed text-white/60"
        >
          {subtext}
        </motion.p>

        <div className="mt-8 space-y-3">
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              transition={{ duration: DURATION.base, ease: EASE_SOFT }}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500/30 to-fuchsia-500/30">
                <f.icon className="h-4.5 w-4.5 text-accent-300" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{f.title}</p>
                <p className="truncate text-xs text-white/50">{f.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DURATION.base, ease: EASE_SOFT, delay: 0.4 }}
        className="relative z-10 text-xs text-white/30"
      >
        Built for agencies managing many clients at once.
      </motion.p>
    </div>
  );
}
