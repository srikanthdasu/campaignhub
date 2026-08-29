'use client';

import { useEffect, useState } from 'react';
import { useMotionValue, useSpring, useMotionValueEvent } from 'framer-motion';
import { cn } from '@/lib/cn';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20, mass: 0.6 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useMotionValueEvent(spring, 'change', (latest) => {
    setDisplay(Math.round(latest));
  });

  return (
    <span className={cn('tabular-nums', className)}>
      {format ? format(display) : display.toLocaleString()}
    </span>
  );
}
