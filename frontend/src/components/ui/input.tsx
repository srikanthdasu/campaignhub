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
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor={id}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition-all duration-200',
            'placeholder:text-neutral-400',
            'focus:border-accent-400 focus:shadow-[0_0_0_4px_var(--color-accent-100)]',
            'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:focus:shadow-[0_0_0_4px_var(--color-accent-900)]',
            className,
          )}
          {...props}
        />
        {hint && <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';
