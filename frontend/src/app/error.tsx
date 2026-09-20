'use client';

import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card padding="lg" className="max-w-sm text-center">
        <h2 className="text-xl font-semibold text-neutral-50">Something went wrong</h2>
        <p className="mt-2 text-sm text-neutral-400">
          This page hit an unexpected error. Try again, or head back to sign in.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => (window.location.href = '/login')}>
            Sign in
          </Button>
          <Button onClick={reset}>Try again</Button>
        </div>
      </Card>
    </div>
  );
}
