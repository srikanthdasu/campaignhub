'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth, ApiError } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { AuthBrandPanel } from '@/components/auth-brand-panel';
import { AuthPromoFooter } from '@/components/auth-promo-footer';
import { DURATION, EASE_SOFT } from '@/lib/motion';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const { verifyEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<'verifying' | 'error'>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('This verification link is missing its token.');
      setState('error');
      return;
    }
    verifyEmail(token)
      .then(() => router.replace('/dashboard'))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Something went wrong');
        setState('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid lg:grid-cols-2 lg:items-start">
      <AuthBrandPanel
        eyebrow="Agency Command Center"
        headline="One more step to activate your workspace."
        subtext="Confirming your email keeps every agency account on CampaignHub AI real and secure."
      />

      <div className="flex flex-col items-center gap-4 px-6 py-8">
        <Card padding="lg" className="w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_SOFT }}
            className="space-y-4 text-center"
          >
            {state === 'verifying' ? (
              <>
                <h2 className="text-2xl font-semibold text-neutral-50">Verifying your email…</h2>
                <p className="text-sm text-neutral-400">Just a moment.</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-semibold text-neutral-50">Verification failed</h2>
                <p className="text-sm leading-relaxed text-neutral-400">{error}</p>
                <p className="pt-2 text-sm text-neutral-400">
                  <Link href="/login" className="font-medium text-accent-300 hover:underline">
                    Back to sign in
                  </Link>{' '}
                  — you can request a new verification link from there.
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
