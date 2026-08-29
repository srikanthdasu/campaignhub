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
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [agencyName, setAgencyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(agencyName, name, email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <AuthBrandPanel
        eyebrow="Agency Command Center"
        headline="Bring your whole agency into one workspace, in minutes."
        subtext="You'll be the Owner — invite your team and clients once you're in."
      />

      <div className="flex items-center justify-center px-6 py-16">
        <Card padding="lg" className="w-full max-w-sm">
          <motion.form
            onSubmit={onSubmit}
            variants={staggerContainer(0.06)}
            initial="hidden"
            animate="show"
            className="space-y-5"
          >
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <h2 className="text-2xl font-semibold text-neutral-50">Create your agency</h2>
              <p className="mt-1 text-sm text-neutral-400">
                You&apos;ll be the Owner of this agency workspace.
              </p>
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
                id="agencyName"
                label="Agency name"
                required
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
              />
            </motion.div>

            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <Input
                id="name"
                label="Your name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </motion.div>

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
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="At least 10 characters."
              />
            </motion.div>

            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <Button type="submit" loading={submitting} className="w-full">
                {submitting ? 'Creating…' : 'Create agency'}
              </Button>
            </motion.div>

            <motion.p
              variants={fadeUp}
              transition={{ duration: DURATION.base, ease: EASE_SOFT }}
              className="text-center text-sm text-neutral-400"
            >
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-accent-300 hover:underline">
                Sign in
              </Link>
            </motion.p>
          </motion.form>
        </Card>
      </div>
    </div>
  );
}
