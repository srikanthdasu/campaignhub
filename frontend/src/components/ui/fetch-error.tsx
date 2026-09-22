'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

interface FetchErrorProps {
  message?: string;
  onRetry: () => void;
}

// For a single widget/section whose own data failed to load — distinct from app/error.tsx's
// full-page boundary, which only catches a render *crash*, not a fetch that resolved to a
// rejected promise. Without this, a failed fetch left as .catch(() => {}) either spins a
// skeleton forever (the loading state never resolves) or silently renders the empty-state
// message, both of which tell the user "there's nothing here" when the real story is "something
// went wrong" — exactly the dashboard's four data widgets before this existed.
export function FetchError({ message = "Couldn't load this — try again.", onRetry }: FetchErrorProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <AlertTriangle className="h-5 w-5 text-amber-400" />
      <p className="text-xs text-neutral-400">{message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
