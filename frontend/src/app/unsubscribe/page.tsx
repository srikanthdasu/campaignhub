'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AuthBrandPanel } from '@/components/auth-brand-panel';
import { AuthPromoFooter } from '@/components/auth-promo-footer';
import { DURATION, EASE_SOFT } from '@/lib/motion';

type State = 'loading' | 'confirm' | 'confirming' | 'done' | 'error';

interface LookupResponse {
  email: string;
  clientName: string;
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeContent />
    </Suspense>
  );
}

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<State>('loading');
  const [info, setInfo] = useState<LookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('This unsubscribe link is missing its token.');
      setState('error');
      return;
    }
    api
      .get<LookupResponse>(`/email-campaigns/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setInfo(res);
        setState('confirm');
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'This link is invalid or has expired.');
        setState('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onConfirm() {
    if (!token) return;
    setState('confirming');
    try {
      await api.post('/email-campaigns/unsubscribe', { token });
      setState('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setState('error');
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <AuthBrandPanel
        eyebrow="Agency Command Center"
        headline="Manage what lands in your inbox."
        subtext="One click keeps you off future emails from this sender."
      />

      <div className="flex flex-col items-center justify-center gap-4 px-6 py-8">
        <Card padding="lg" className="w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_SOFT }}
            className="space-y-4 text-center"
          >
            {state === 'loading' && (
              <>
                <h2 className="text-2xl font-semibold text-neutral-50">Loading…</h2>
                <p className="text-sm text-neutral-400">Just a moment.</p>
              </>
            )}

            {(state === 'confirm' || state === 'confirming') && info && (
              <>
                <h2 className="text-2xl font-semibold text-neutral-50">Unsubscribe from {info.clientName}?</h2>
                <p className="text-sm leading-relaxed text-neutral-400">
                  We&apos;ll stop sending marketing emails to <span className="text-neutral-200">{info.email}</span>{' '}
                  from {info.clientName}. This won&apos;t affect any other emails you receive.
                </p>
                <Button onClick={onConfirm} loading={state === 'confirming'} className="w-full">
                  Confirm unsubscribe
                </Button>
              </>
            )}

            {state === 'done' && (
              <>
                <h2 className="text-2xl font-semibold text-neutral-50">You&apos;re unsubscribed</h2>
                <p className="text-sm leading-relaxed text-neutral-400">
                  {info?.email} won&apos;t receive further emails from {info?.clientName}.
                </p>
              </>
            )}

            {state === 'error' && (
              <>
                <h2 className="text-2xl font-semibold text-neutral-50">Something went wrong</h2>
                <p className="text-sm leading-relaxed text-neutral-400">{error}</p>
                <p className="pt-2 text-sm text-neutral-400">
                  <Link href="/" className="font-medium text-accent-300 hover:underline">
                    Return home
                  </Link>
                </p>
              </>
            )}
          </motion.div>
        </Card>

        <AuthPromoFooter />
      </div>
    </div>
  );
}
