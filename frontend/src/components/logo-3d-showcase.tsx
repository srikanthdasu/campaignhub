'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { DURATION, EASE_SOFT } from '@/lib/motion';
import { cn } from '@/lib/cn';

// Replaces the old abstract distorted-sphere blob with the actual brand mark, given real
// depth via mouse-parallax tilt + a floating idle bob — the same technique already proven on
// the auth pages' SocialConstellation center mark, just standalone and larger here.
export function Logo3DShowcase({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 120, damping: 20, mass: 0.4 });
  const springY = useSpring(pointerY, { stiffness: 120, damping: 20, mass: 0.4 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [14, -14]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-14, 14]);

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
      className={cn('relative flex items-center justify-center', className)}
      style={{ perspective: 800 }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(91,99,245,0.35), rgba(232,121,249,0.18) 55%, transparent 75%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: DURATION.slow, ease: EASE_SOFT }}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-32 w-32 items-center justify-center rounded-[2rem] bg-gradient-to-br from-accent-400 via-accent-600 to-fuchsia-500 shadow-[0_20px_60px_-12px_rgba(91,99,245,0.6)] sm:h-40 sm:w-40"
          style={{ transform: 'translateZ(20px)' }}
        >
          <Image
            src="/brand/emblem.png"
            alt="CampaignHub AI"
            width={96}
            height={91}
            priority
            className="h-16 w-auto object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] sm:h-20"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
