'use client';

import { ReactNode, useState } from 'react';
import { Button } from './button';

interface ConfirmButtonProps {
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  confirmLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'secondary' | 'ghost';
  className?: string;
  disabled?: boolean;
}

// A destructive action's own button flips in place into "Confirm / Cancel" on first click,
// instead of firing immediately — no modal/portal needed, and it matches the inline
// confirm-in-place pattern this app already uses elsewhere (e.g. client delete on Agency & Clients).
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Confirm',
  size = 'sm',
  variant = 'secondary',
  className,
  disabled,
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Button
          size={size}
          variant="danger"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
              setConfirming(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
        <Button size={size} variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <Button size={size} variant={variant} className={className} disabled={disabled} onClick={() => setConfirming(true)}>
      {children}
    </Button>
  );
}
