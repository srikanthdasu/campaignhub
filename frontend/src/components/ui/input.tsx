'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, id, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-neutral-300" htmlFor={id}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none transition-all duration-200',
            'placeholder:text-neutral-500',
            'hover:border-white/20',
            'focus:border-accent-400 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(91,99,245,0.18)]',
            className,
          )}
          {...props}
        />
        {hint && <p className="text-xs text-neutral-400">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';
