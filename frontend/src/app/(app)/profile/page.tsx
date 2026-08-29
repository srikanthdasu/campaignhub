'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { ROLE_LABELS, Role } from '@/lib/roles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  notificationPrefs: { emailOnApproval?: boolean } | null;
  createdAt: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [emailOnApproval, setEmailOnApproval] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Profile>('/users/me')
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setEmailOnApproval(p.notificationPrefs?.emailOnApproval ?? true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.patch<Profile>('/users/me', {
        name,
        notificationPrefs: { emailOnApproval },
      });
      setProfile(updated);
      setMessage('Profile updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-md space-y-6">
        <Skeleton className="h-8 w-40" />
        <Card padding="lg" className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </Card>
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-red-600">{error ?? 'Profile not found'}</p>;
  }

  return (
    <motion.div
      variants={staggerContainer(0.07)}
      initial="hidden"
      animate="show"
      className="max-w-md space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Your profile
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{profile.email}</p>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300"
          >
            {error}
          </motion.p>
        )}
        {message && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <Card padding="lg">
          <form onSubmit={onSubmit} className="space-y-5">
            <Input id="name" label="Name" value={name} onChange={(e) => setName(e.target.value)} />

            <div className="space-y-1.5">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Role
              </span>
              <div>
                <Badge tone="accent">{ROLE_LABELS[profile.role]}</Badge>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={emailOnApproval}
                onChange={(e) => setEmailOnApproval(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-accent-600 focus:ring-accent-400"
              />
              Email me when content needs my approval
            </label>

            <Button type="submit" loading={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </Card>
      </motion.div>
    </motion.div>
  );
}
