'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

const PLATFORMS = [
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
  'X',
  'TIKTOK',
  'YOUTUBE',
  'PINTEREST',
  'WHATSAPP',
] as const;

interface SocialAccount {
  id: string;
  platform: (typeof PLATFORMS)[number];
  label: string;
  externalAccountId: string | null;
  connectedAt: string;
}

export default function SocialAccountsPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('INSTAGRAM');
  const [label, setLabel] = useState('');

  function load(clientId: string) {
    api
      .get<SocialAccount[]>(`/clients/${clientId}/social-accounts`)
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }

  useEffect(() => {
    if (selectedClientId) load(selectedClientId);
  }, [selectedClientId]);

  // Facebook's OAuth dialog redirects the whole browser back to this exact page — the result
  // arrives as a query param, not a normal API response, since there's no in-page JS context left
  // to hand a result to after that round trip. router.replace strips it once read so a refresh
  // doesn't re-show the same message.
  useEffect(() => {
    const connected = searchParams.get('connected');
    const connectError = searchParams.get('connect_error');
    if (connected) {
      setNotice(`${connected.charAt(0).toUpperCase()}${connected.slice(1)} account connected.`);
      if (selectedClientId) load(selectedClientId);
      router.replace('/social-accounts');
    } else if (connectError) {
      setError(connectError);
      router.replace('/social-accounts');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function onConnectFacebook() {
    if (!selectedClientId) return;
    setError(null);
    setConnecting(true);
    try {
      const { url } = await api.get<{ url: string }>(`/clients/${selectedClientId}/social-accounts/facebook/connect`);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start Facebook connection');
      setConnecting(false);
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!selectedClientId) return;
    setError(null);
    setCreating(true);
    try {
      await api.post(`/clients/${selectedClientId}/social-accounts`, { platform, label });
      setLabel('');
      load(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add account');
    } finally {
      setCreating(false);
    }
  }

  async function onRemove(id: string) {
    if (!selectedClientId) return;
    try {
      await api.delete(`/clients/${selectedClientId}/social-accounts/${id}`);
      setAccounts((prev) => prev?.filter((a) => a.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove account');
    }
  }

  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="show"
      className="max-w-2xl space-y-6"
    >
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Social Accounts &amp; Integrations</h1>
        <p className="text-sm text-neutral-400">
          Track which platform accounts each client publishes to.
        </p>
        <p className="mt-2 text-xs text-amber-300/80">
          Facebook connects via real Meta OAuth below. Other platforms are still added manually —
          each needs its own registered developer app, which isn&apos;t set up yet.
        </p>
      </motion.div>

      {clients && clients.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">
            No clients yet — create one from Agency &amp; Clients first.
          </p>
        </Card>
      ) : (
        <>
          {clients && (
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <ClientPicker clients={clients} value={selectedClientId} onChange={setSelectedClientId} />
            </motion.div>
          )}

          <AnimatePresence>
            {notice && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-300"
              >
                {notice}
              </motion.p>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
            <Card padding="lg" className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-50">Facebook</h2>
                <p className="text-xs text-neutral-400">
                  Connect a real Facebook account via Meta login.
                </p>
              </div>
              <Button size="sm" loading={connecting} onClick={onConnectFacebook}>
                Connect Facebook
              </Button>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
            <Card padding="lg">
              <h2 className="mb-4 text-sm font-semibold text-neutral-50">Add an account manually</h2>
              <form onSubmit={onAdd} className="flex items-end gap-3">
                <Select
                  label="Platform"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as (typeof PLATFORMS)[number])}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <div className="flex-1">
                  <Input
                    label="Label"
                    placeholder="@acmecorp"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" loading={creating}>
                  Add
                </Button>
              </form>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
            {accounts === null ? (
              <Skeleton className="h-16 w-full rounded-2xl" />
            ) : accounts.length === 0 ? (
              <Card padding="lg">
                <p className="text-sm text-neutral-400">No accounts connected yet.</p>
              </Card>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {accounts.map((account) => (
                    <motion.li
                      key={account.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                    >
                      <Card padding="md" className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge tone="neutral">{account.platform}</Badge>
                          <span className="text-sm text-neutral-200">{account.label}</span>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => onRemove(account.id)}>
                          Remove
                        </Button>
                      </Card>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
