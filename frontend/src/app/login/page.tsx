'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth, ApiError } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AuthBrandPanel } from '@/components/auth-brand-panel';
import { AuthPromoFooter } from '@/components/auth-promo-footer';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 lg:items-start">
      <AuthBrandPanel
        eyebrow="Agency Command Center"
        headline="Run every client campaign from one calm, connected workspace."
        subtext="Auth, roles, clients, approvals, publishing, and AI — built for agencies that manage many brands at once."
      />

      <div className="flex flex-col items-center gap-4 px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_SOFT }}
          className="w-full max-w-sm text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-400">
            CampaignHub AI
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            One workspace to plan, approve, and publish every client campaign — with AI built in
            at every step.
          </p>
        </motion.div>

        <Card padding="lg" className="w-full max-w-sm">
          <motion.form
            onSubmit={onSubmit}
            variants={staggerContainer(0.07)}
            initial="hidden"
            animate="show"
            className="space-y-5"
          >
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <h2 className="text-2xl font-semibold text-neutral-50">Sign in</h2>
              <p className="mt-1 text-sm text-neutral-400">Welcome back to CampaignHub AI</p>
            </motion.div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.fast, ease: EASE_SOFT }}
                  className="overflow-hidden rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <Input
                id="email"
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </motion.div>

            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <Input
                id="password"
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </motion.div>

            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <Button type="submit" loading={submitting} className="w-full">
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </motion.div>

            <motion.p
              variants={fadeUp}
              transition={{ duration: DURATION.base, ease: EASE_SOFT }}
              className="text-center text-sm text-neutral-400"
            >
              Setting up a new agency?{' '}
              <Link href="/register" className="font-medium text-accent-300 hover:underline">
                Create one
              </Link>
            </motion.p>
          </motion.form>
        </Card>

        <AuthPromoFooter />
      </div>
    </div>
  );
}
