'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth, ApiError } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AuthBrandPanel } from '@/components/auth-brand-panel';
import { AuthPromoFooter } from '@/components/auth-promo-footer';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <AuthBrandPanel
        eyebrow="Agency Command Center"
        headline="Choose a new password."
        subtext="Once this is set, every other device you're signed in on will need to sign in again."
      />

      <div className="flex flex-col items-center justify-center gap-4 px-6 py-8">
        <Card padding="lg" className="w-full max-w-sm">
          {!token ? (
            <div className="space-y-4 text-center">
              <h2 className="text-2xl font-semibold text-neutral-50">Link missing its token</h2>
              <p className="text-sm leading-relaxed text-neutral-400">
                This reset link looks incomplete. Request a new one from the sign-in page.
              </p>
              <p className="pt-2 text-sm text-neutral-400">
                <Link href="/forgot-password" className="font-medium text-accent-300 hover:underline">
                  Request a new link
                </Link>
              </p>
            </div>
          ) : (
            <motion.form
              onSubmit={onSubmit}
              variants={staggerContainer(0.07)}
              initial="hidden"
              animate="show"
              className="space-y-5"
            >
              <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
                <h2 className="text-2xl font-semibold text-neutral-50">Choose a new password</h2>
                <p className="mt-1 text-sm text-neutral-400">At least 10 characters.</p>
              </motion.div>

              {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                  <p>{error}</p>
                  <p className="mt-1.5">
                    <Link href="/forgot-password" className="font-medium underline">
                      Request a new link
                    </Link>
                  </p>
                </div>
              )}

              <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
                <Input
                  id="newPassword"
                  label="New password"
                  type="password"
                  required
                  minLength={10}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
              </motion.div>

              <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
                <Button type="submit" loading={submitting} className="w-full">
                  {submitting ? 'Resetting…' : 'Reset password'}
                </Button>
              </motion.div>
            </motion.form>
          )}
        </Card>

        <AuthPromoFooter />
      </div>
    </div>
  );
}
