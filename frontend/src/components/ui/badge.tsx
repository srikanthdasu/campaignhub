import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const toneClasses: Record<Tone, string> = {
  neutral: 'border-white/12 bg-white/[0.05] text-neutral-300',
  accent: 'border-accent-400/30 bg-accent-500/15 text-accent-200',
  success: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
  warning: 'border-amber-400/30 bg-amber-500/15 text-amber-300',
  danger: 'border-red-400/30 bg-red-500/15 text-red-300',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-sm',
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
