'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { ReactNode } from 'react';
import { cardHover, DURATION, EASE_SOFT } from '@/lib/motion';
import { cn } from '@/lib/cn';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  hoverable = false,
  padding = 'md',
  className,
  ...props
}: CardProps) {
  return (
    <motion.div
      initial="rest"
      whileHover={hoverable ? 'hover' : undefined}
      variants={cardHover}
      transition={{ duration: DURATION.fast, ease: EASE_SOFT }}
      className={cn(
        'card-surface rounded-2xl shadow-md',
        hoverable && 'cursor-pointer hover:shadow-lg',
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
