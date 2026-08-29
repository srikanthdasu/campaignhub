'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth, ApiError } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GradientMeshHeroLazy } from '@/components/three/gradient-mesh-hero-lazy';
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
    <div className="grid flex-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-neutral-900 via-accent-900 to-neutral-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 -z-0 flex items-center justify-center">
          <GradientMeshHeroLazy className="h-[28rem] w-[28rem]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_SOFT }}
          className="relative z-10 flex items-center gap-2.5"
        >
          <Image src="/brand/emblem.png" alt="" width={30} height={28} className="h-7 w-auto" />
          <div>
            <p className="text-sm font-semibold tracking-wide text-white">CampaignHub AI</p>
            <p className="text-xs text-white/50">by Sreema</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE_SOFT, delay: 0.1 }}
          className="relative z-10 max-w-md"
        >
          <h1 className="text-balance-pretty text-4xl font-semibold leading-tight text-white">
            Run every client campaign from one calm, connected workspace.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Auth, roles, clients, approvals, publishing, and AI — built for agencies that manage
            many brands at once.
          </p>
        </motion.div>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <motion.form
          onSubmit={onSubmit}
          variants={staggerContainer(0.07)}
          initial="hidden"
          animate="show"
          className="w-full max-w-sm space-y-5"
        >
          <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
              Sign in
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Welcome back to CampaignHub AI
            </p>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE_SOFT }}
                className="overflow-hidden rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300"
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
            className="text-center text-sm text-neutral-500 dark:text-neutral-400"
          >
            Setting up a new agency?{' '}
            <Link href="/register" className="font-medium text-accent-600 hover:underline dark:text-accent-400">
              Create one
            </Link>
          </motion.p>
        </motion.form>
      </div>
    </div>
  );
}
