'use client';

import { SelectHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, id, className, children, ...props }, ref) => {
    const generatedId = useId();
    const resolvedId = id ?? (label ? generatedId : undefined);
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-neutral-300" htmlFor={resolvedId}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={resolvedId}
          className={cn(
            'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none transition-all duration-200',
            'hover:border-white/20',
            'focus:border-accent-400 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(91,99,245,0.18)]',
            '[&>option]:bg-neutral-900',
            className,
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  },
);
Select.displayName = 'Select';
