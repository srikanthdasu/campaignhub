'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { PLATFORM_COLORS, PLATFORM_ICONS, PLATFORM_ORDER } from '@/lib/platform-icons';
import { DURATION, EASE_SOFT } from '@/lib/motion';
import { cn } from '@/lib/cn';

interface StatChip {
  label: string;
  value: string;
  tone: 'success' | 'accent' | 'neutral';
  className: string;
  delay: number;
}

const STATS: StatChip[] = [
  { label: 'ENGAGEMENT', value: '+87%', tone: 'success', className: 'left-0 top-[6%]', delay: 0 },
  { label: 'AI ENGINE', value: 'Ready', tone: 'accent', className: 'right-0 top-0', delay: 0.6 },
  { label: 'NEXT POST', value: 'Tomorrow · 10:30', tone: 'neutral', className: 'left-[4%] bottom-0', delay: 1.2 },
];

const toneClasses: Record<StatChip['tone'], string> = {
  success: 'text-emerald-300',
  accent: 'text-accent-300',
  neutral: 'text-neutral-200',
};

interface SocialConstellationProps {
  size?: 'lg' | 'md' | 'sm';
  showStats?: boolean;
  hint?: boolean;
  className?: string;
}

const SIZES = {
  lg: { dims: 264, radius: 114, centerSize: 68, chipSize: 40, iconSize: 17 },
  md: { dims: 208, radius: 90, centerSize: 60, chipSize: 36, iconSize: 16 },
  sm: { dims: 128, radius: 54, centerSize: 38, chipSize: 26, iconSize: 13 },
} as const;

export function SocialConstellation({
  size = 'lg',
  showStats = false,
  hint = false,
  className,
}: SocialConstellationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 120, damping: 20, mass: 0.4 });
  const springY = useSpring(pointerY, { stiffness: 120, damping: 20, mass: 0.4 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-8, 8]);
  const shiftX = useTransform(springX, [-0.5, 0.5], [-10, 10]);
  const shiftY = useTransform(springY, [-0.5, 0.5], [-10, 10]);

  const { dims, radius, centerSize, chipSize, iconSize } = SIZES[size];

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerX.set((e.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function onPointerLeave() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn('relative mx-auto', className)}
      style={{ width: dims + chipSize, height: dims + chipSize, perspective: 900 }}
    >
      {/* Faint concentric rings for depth */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-full border border-white/[0.06]"
          style={{ width: dims * 0.7, height: dims * 0.7 }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="rounded-full border border-white/[0.08]" style={{ width: dims, height: dims }} />
      </div>
      <div
        className="pointer-events-none absolute inset-0 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(91,99,245,0.25), rgba(232,121,249,0.12) 55%, transparent 75%)',
        }}
      />

      <motion.div
        className="absolute inset-0"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      >
        {/* Center brand mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DURATION.slow, ease: EASE_SOFT }}
          style={{ x: shiftX, y: shiftY }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <div
            className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-accent-400 via-accent-600 to-fuchsia-500 shadow-[0_0_50px_-8px_rgba(91,99,245,0.7)]"
            style={{ width: centerSize, height: centerSize }}
          >
            <Image
              src="/brand/emblem.png"
              alt="CampaignHub AI"
              width={centerSize * 0.6}
              height={centerSize * 0.6}
              priority
              className="object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
            />
          </div>
        </motion.div>

        {/* Platform icon chips — fixed positions, gentle independent float */}
        {PLATFORM_ORDER.map((platform, i) => {
          const angle = (360 / PLATFORM_ORDER.length) * i - 90;
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;
          const Icon = PLATFORM_ICONS[platform];
          return (
            <motion.div
              key={platform}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.05, duration: DURATION.slow, ease: EASE_SOFT }}
              className="absolute left-1/2 top-1/2"
              style={{ x, y, marginLeft: -chipSize / 2, marginTop: -chipSize / 2 }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 3.2 + (i % 3) * 0.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.2,
                }}
              >
                <motion.div
                  whileHover={{ scale: 1.15 }}
                  transition={{ duration: DURATION.fast, ease: EASE_SOFT }}
                  className="flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.07] backdrop-blur-sm"
                  style={{
                    width: chipSize,
                    height: chipSize,
                    boxShadow: `0 8px 20px -6px rgba(0,0,0,0.6), 0 0 16px -4px ${PLATFORM_COLORS[platform]}55`,
                  }}
                >
                  <Icon size={iconSize} color={PLATFORM_COLORS[platform]} />
                </motion.div>
              </motion.div>
            </motion.div>
          );
        })}

        {showStats &&
          STATS.map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + stat.delay * 0.15, duration: DURATION.slow, ease: EASE_SOFT }}
              className={cn('absolute hidden rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 backdrop-blur-md sm:block', stat.className)}
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: stat.delay }}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
                  {stat.label}
                </p>
                <p className={cn('text-sm font-semibold', toneClasses[stat.tone])}>{stat.value}</p>
              </motion.div>
            </motion.div>
          ))}
      </motion.div>

      {hint && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: DURATION.base, ease: EASE_SOFT }}
          className="pointer-events-none absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-neutral-500"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
          Move your cursor
        </motion.div>
      )}
    </div>
  );
}
