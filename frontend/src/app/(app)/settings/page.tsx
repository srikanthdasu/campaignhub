'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { isAgencyAdmin, Role } from '@/lib/roles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

interface Agency {
  id: string;
  name: string;
  plan: string;
  subscriptionStatus: string;
  settings: { timezone?: string; brandColor?: string } | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const admin = isAgencyAdmin(user?.role as Role | undefined);

  const [agency, setAgency] = useState<Agency | null>(null);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [brandColor, setBrandColor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Agency>('/agencies/me')
      .then((a) => {
        setAgency(a);
        setName(a.name);
        setTimezone(a.settings?.timezone ?? '');
        setBrandColor(a.settings?.brandColor ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load agency'))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.patch<Agency>('/agencies/me/settings', {
        name,
        settings: { timezone, brandColor },
      });
      setAgency(updated);
      setMessage('Settings saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-md space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card padding="lg" className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </Card>
      </div>
    );
  }

  if (!agency) {
    return <p className="text-sm text-red-600">{error ?? 'Agency not found'}</p>;
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
          Agency settings
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone="accent">{agency.plan}</Badge>
          <Badge tone="neutral">{agency.subscriptionStatus}</Badge>
        </div>
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
          {!admin ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Agency name: <span className="font-medium">{agency.name}</span>
              <br />
              Only Owners and Admins can change agency settings.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <Input
                id="agencyName"
                label="Agency name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                id="timezone"
                label="Timezone"
                placeholder="Asia/Kolkata"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
              <Input
                id="brandColor"
                label="Brand color"
                placeholder="#1D4ED8"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
              />
              <Button type="submit" loading={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
