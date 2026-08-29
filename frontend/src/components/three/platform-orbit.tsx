'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { GradientMeshHeroLazy } from '@/components/three/gradient-mesh-hero-lazy';
import { DURATION, EASE_SOFT } from '@/lib/motion';

const PLATFORMS = [
  { name: 'facebook', label: 'Facebook' },
  { name: 'youtube', label: 'YouTube' },
  { name: 'whatsapp', label: 'WhatsApp' },
  { name: 'instagram', label: 'Instagram' },
  { name: 'linkedin', label: 'LinkedIn' },
  { name: 'wechat', label: 'WeChat' },
  { name: 'snapchat', label: 'Snapchat' },
  { name: 'pinterest', label: 'Pinterest' },
  { name: 'tiktok', label: 'TikTok' },
  { name: 'x', label: 'X' },
];

const RADIUS = 122;
const ORBIT_DURATION = 46;

export function PlatformOrbit({ className }: { className?: string }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={className}>
      <div className="relative mx-auto h-[320px] w-[320px]">
        <div className="absolute inset-0 flex items-center justify-center">
          <GradientMeshHeroLazy className="h-32 w-32" />
        </div>

        {/* Rotates the whole ring — a motion component, so it owns its own `transform` */}
        <motion.div
          className="absolute inset-0"
          animate={prefersReducedMotion ? undefined : { rotate: 360 }}
          transition={{ duration: ORBIT_DURATION, repeat: Infinity, ease: 'linear' }}
        >
          {PLATFORMS.map((p, i) => {
            const angle = (360 / PLATFORMS.length) * i;
            return (
              // Plain div for placement: a motion.div here would fight the ring/entrance
              // animations for control of `transform`, since Framer Motion owns that
              // property on any element it animates and overwrites a literal style.transform.
              <div
                key={p.name}
                className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2"
                style={{ transform: `rotate(${angle}deg) translate(${RADIUS}px)` }}
              >
                <motion.div
                  className="h-full w-full"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.06, duration: DURATION.slow, ease: EASE_SOFT }}
                >
                  <motion.div
                    className="h-full w-full"
                    animate={prefersReducedMotion ? undefined : { rotate: -360 }}
                    transition={{ duration: ORBIT_DURATION, repeat: Infinity, ease: 'linear' }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.18 }}
                      transition={{ duration: DURATION.fast, ease: EASE_SOFT }}
                      className="h-full w-full overflow-hidden rounded-full border-2 border-white/15 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.5)]"
                    >
                      <Image
                        src={`/brand/social/${p.name}.png`}
                        alt={p.label}
                        width={96}
                        height={96}
                        className="h-full w-full object-cover"
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
