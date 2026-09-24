'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth, ApiError } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AuthBrandPanel } from '@/components/auth-brand-panel';
import { AuthPromoFooter } from '@/components/auth-promo-footer';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      // The backend always returns the same generic message whether or not the account exists —
      // the frontend shouldn't undermine that by branching on the response either.
      setSent(true);
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
        headline="Locked out happens. Let's get you back in."
        subtext="We'll email a link to reset your password — it only works for the next hour."
      />

      <div className="flex flex-col items-center justify-center gap-4 px-6 py-8">
        <Card padding="lg" className="w-full max-w-sm">
          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.base, ease: EASE_SOFT }}
              className="space-y-4 text-center"
            >
              <h2 className="text-2xl font-semibold text-neutral-50">Check your inbox</h2>
              <p className="text-sm leading-relaxed text-neutral-400">
                If an account exists for <span className="text-neutral-200">{email}</span>, a
                password reset link is on its way. It expires in 1 hour.
              </p>
              <p className="pt-2 text-sm text-neutral-400">
                <Link href="/login" className="font-medium text-accent-300 hover:underline">
                  Back to sign in
                </Link>
              </p>
            </motion.div>
          ) : (
            <motion.form
              onSubmit={onSubmit}
              variants={staggerContainer(0.07)}
              initial="hidden"
              animate="show"
              className="space-y-5"
            >
              <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
                <h2 className="text-2xl font-semibold text-neutral-50">Reset your password</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Enter the email on your account and we&apos;ll send you a reset link.
                </p>
              </motion.div>

              {error && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                  {error}
                </p>
              )}

              <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
                <Input
                  id="email"
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </motion.div>

              <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
                <Button type="submit" loading={submitting} className="w-full">
                  {submitting ? 'Sending…' : 'Send reset link'}
                </Button>
              </motion.div>

              <motion.p
                variants={fadeUp}
                transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                className="text-center text-sm text-neutral-400"
              >
                <Link href="/login" className="font-medium text-accent-300 hover:underline">
                  Back to sign in
                </Link>
              </motion.p>
            </motion.form>
          )}
        </Card>

        <AuthPromoFooter />
      </div>
    </div>
  );
}
