'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import {
  Users,
  Camera,
  ThumbsUp,
  Briefcase,
  AtSign,
  PlayCircle,
  MessageCircle,
  PlusCircle,
  List,
  Search,
  type LucideIcon,
} from 'lucide-react';

// Public, client-facing identifiers for the WhatsApp Embedded Signup JS SDK popup — not secrets
// (the app secret used to exchange the resulting code for a token stays server-side only).
const WHATSAPP_APP_ID = '1412830383946851';
const WHATSAPP_CONFIG_ID = '2037537230301004';

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (options: { appId: string; version: string; xfbml?: boolean }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        options: {
          config_id: string;
          response_type: string;
          override_default_response_type: boolean;
          extras?: { setup: Record<string, never> };
        },
      ) => void;
    };
  }
}

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

function PanelHeader({ n, title, icon: Icon, color }: { n: number; title: string; icon: LucideIcon; color: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {n}
      </span>
      <Icon className="h-4 w-4 shrink-0" style={{ color }} strokeWidth={2} />
      <h2 className="text-sm font-semibold text-neutral-50">{title}</h2>
    </div>
  );
}

function ConnectPanel({
  n,
  title,
  icon,
  color,
  description,
  buttonLabel,
  loading,
  disabled,
  onConnect,
}: {
  n: number;
  title: string;
  icon: LucideIcon;
  color: string;
  description: string;
  buttonLabel: string;
  loading: boolean;
  disabled: boolean;
  onConnect: () => void;
}) {
  return (
    <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
      <PanelHeader n={n} title={title} icon={icon} color={color} />
      <p className="mb-3 text-xs text-neutral-400">{description}</p>
      <Button size="sm" className="w-full" loading={loading} disabled={disabled} onClick={onConnect}>
        {buttonLabel}
      </Button>
    </Card>
  );
}

export default function SocialAccountsPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [connectingFacebook, setConnectingFacebook] = useState(false);
  const [connectingInstagram, setConnectingInstagram] = useState(false);
  const [connectingWhatsApp, setConnectingWhatsApp] = useState(false);
  const [connectingLinkedIn, setConnectingLinkedIn] = useState(false);
  const [connectingX, setConnectingX] = useState(false);
  const [connectingYouTube, setConnectingYouTube] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  const waPhoneNumberIdRef = useRef<string | null>(null);
  const waResolveRef = useRef<((id: string | null) => void) | null>(null);

  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('TIKTOK');
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

  // Deep-linked from elsewhere (e.g. the client onboarding wizard's "Connect Accounts" step)
  // with ?client=<id> to land here with the right client already selected.
  useEffect(() => {
    const clientParam = searchParams.get('client');
    if (clientParam) setSelectedClientId(clientParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WhatsApp Embedded Signup runs inside a JS SDK popup rather than a page redirect, so the SDK
  // needs to be loaded once up front.
  useEffect(() => {
    if (document.getElementById('facebook-jssdk')) return;
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: WHATSAPP_APP_ID, version: 'v21.0', xfbml: false });
    };
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  // The popup reports the chosen phone_number_id via postMessage, arriving independently of (and
  // usually just before) FB.login's own callback — stash it in a ref that onConnectWhatsApp reads.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== 'https://www.facebook.com' || typeof event.data !== 'string') return;
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (
        typeof data === 'object' &&
        data !== null &&
        (data as Record<string, unknown>).type === 'WA_EMBEDDED_SIGNUP' &&
        (data as Record<string, unknown>).event === 'FINISH'
      ) {
        const phoneNumberId = (data as { data?: { phone_number_id?: string } }).data?.phone_number_id ?? null;
        waPhoneNumberIdRef.current = phoneNumberId;
        waResolveRef.current?.(phoneNumberId);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
    setConnectingFacebook(true);
    try {
      const { url } = await api.get<{ url: string }>(`/clients/${selectedClientId}/social-accounts/facebook/connect`);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start Facebook connection');
      setConnectingFacebook(false);
    }
  }

  async function onConnectInstagram() {
    if (!selectedClientId) return;
    setError(null);
    setConnectingInstagram(true);
    try {
      const { url } = await api.get<{ url: string }>(`/clients/${selectedClientId}/social-accounts/instagram/connect`);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start Instagram connection');
      setConnectingInstagram(false);
    }
  }

  async function onConnectLinkedIn() {
    if (!selectedClientId) return;
    setError(null);
    setConnectingLinkedIn(true);
    try {
      const { url } = await api.get<{ url: string }>(`/clients/${selectedClientId}/social-accounts/linkedin/connect`);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start LinkedIn connection');
      setConnectingLinkedIn(false);
    }
  }

  function onConnectWhatsApp() {
    if (!selectedClientId || !window.FB) {
      setError('WhatsApp login is still loading — please try again in a moment.');
      return;
    }
    setError(null);
    setConnectingWhatsApp(true);
    waPhoneNumberIdRef.current = null;

    // FB.login's own SDK code rejects an `async` function passed directly as the callback (throws
    // "Expression is of type asyncfunction, not function" from inside its minified source) — the
    // callback here must stay a plain synchronous function, with the async work delegated out.
    window.FB.login((response) => {
      handleWhatsAppLoginResponse(response);
    }, {
      config_id: WHATSAPP_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {} },
    });
  }

  async function handleWhatsAppLoginResponse(response: { authResponse?: { code?: string } }) {
    const code = response.authResponse?.code;
    if (!code) {
      setError('WhatsApp connection was cancelled or failed');
      setConnectingWhatsApp(false);
      return;
    }

    const phoneNumberId =
      waPhoneNumberIdRef.current ??
      (await new Promise<string | null>((resolve) => {
        waResolveRef.current = resolve;
        setTimeout(() => resolve(null), 5000);
      }));
    waResolveRef.current = null;

    if (!phoneNumberId) {
      setError('Did not receive a WhatsApp phone number from Meta. Please try again.');
      setConnectingWhatsApp(false);
      return;
    }

    if (!selectedClientId) return;
    try {
      await api.post(`/clients/${selectedClientId}/social-accounts/whatsapp/connect`, { code, phoneNumberId });
      setNotice('WhatsApp account connected.');
      load(selectedClientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to connect WhatsApp account');
    } finally {
      setConnectingWhatsApp(false);
    }
  }

  async function onConnectX() {
    if (!selectedClientId) return;
    setError(null);
    setConnectingX(true);
    try {
      const { url } = await api.get<{ url: string }>(`/clients/${selectedClientId}/social-accounts/x/connect`);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start X connection');
      setConnectingX(false);
    }
  }

  async function onConnectYouTube() {
    if (!selectedClientId) return;
    setError(null);
    setConnectingYouTube(true);
    try {
      const { url } = await api.get<{ url: string }>(`/clients/${selectedClientId}/social-accounts/youtube/connect`);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start YouTube connection');
      setConnectingYouTube(false);
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

  const disabled = !selectedClientId;
  const filteredClients = (clients ?? []).filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  const selectedClient = (clients ?? []).find((c) => c.id === selectedClientId);
  const platformCounts = PLATFORMS.reduce<Record<string, number>>((acc, p) => {
    acc[p] = accounts?.filter((a) => a.platform === p).length ?? 0;
    return acc;
  }, {});

  return (
    <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="max-w-[1500px] space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Social Accounts &amp; Integrations</h1>
        <p className="text-sm text-neutral-400">Pick a client, then connect every platform they publish to.</p>
        <p className="mt-1 text-xs text-amber-300/80">
          Facebook, Instagram, LinkedIn, X, YouTube, and WhatsApp connect via real login below —
          the account ID is captured automatically, nothing to type in. TikTok and Pinterest are
          still added manually, since neither has a registered developer app yet.
        </p>
      </motion.div>

      {clients && clients.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">No clients yet — create one from Agency &amp; Clients first.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AnimatePresence>
              {notice && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="col-span-full overflow-hidden rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-300"
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
                  className="col-span-full overflow-hidden rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* 1. Select Client */}
            <Card padding="lg">
              <PanelHeader n={1} title="Select Client" icon={Users} color="#6366f1" />
              <p className="mb-2 text-xs text-neutral-500">
                {clients?.length ?? 0} client{(clients?.length ?? 0) === 1 ? '' : 's'} in your agency.
              </p>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
                <input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search clients…"
                  className="w-full rounded-lg border border-white/12 bg-white/[0.04] py-1.5 pl-8 pr-2.5 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                />
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {filteredClients.length === 0 ? (
                  <p className="px-1 text-[11px] text-neutral-500">No clients match.</p>
                ) : (
                  filteredClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      className={`w-full min-w-0 truncate rounded-lg px-2.5 py-1.5 text-left text-xs ${
                        selectedClientId === c.id
                          ? 'bg-accent-500/15 text-accent-200'
                          : 'text-neutral-400 hover:bg-white/[0.05]'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))
                )}
              </div>
            </Card>

            <ConnectPanel
              n={2}
              title="Instagram"
              icon={Camera}
              color="#d946ef"
              description="Connect a real Instagram Business or Creator account."
              buttonLabel="Connect Instagram"
              loading={connectingInstagram}
              disabled={disabled}
              onConnect={onConnectInstagram}
            />
            <ConnectPanel
              n={3}
              title="Facebook"
              icon={ThumbsUp}
              color="#0ea5e9"
              description="Connect a real Facebook Page via Meta login."
              buttonLabel="Connect Facebook"
              loading={connectingFacebook}
              disabled={disabled}
              onConnect={onConnectFacebook}
            />
            <ConnectPanel
              n={4}
              title="LinkedIn"
              icon={Briefcase}
              color="#2563eb"
              description="Connect a real LinkedIn account via LinkedIn login."
              buttonLabel="Connect LinkedIn"
              loading={connectingLinkedIn}
              disabled={disabled}
              onConnect={onConnectLinkedIn}
            />
            <ConnectPanel
              n={5}
              title="X"
              icon={AtSign}
              color="#f43f5e"
              description="Connect a real X (Twitter) account via X login."
              buttonLabel="Connect X"
              loading={connectingX}
              disabled={disabled}
              onConnect={onConnectX}
            />
            <ConnectPanel
              n={6}
              title="YouTube"
              icon={PlayCircle}
              color="#ef4444"
              description="Connect a real YouTube channel via Google login."
              buttonLabel="Connect YouTube"
              loading={connectingYouTube}
              disabled={disabled}
              onConnect={onConnectYouTube}
            />
            <ConnectPanel
              n={7}
              title="WhatsApp"
              icon={MessageCircle}
              color="#22c55e"
              description="Connect a real WhatsApp Business Account via Meta."
              buttonLabel="Connect WhatsApp"
              loading={connectingWhatsApp}
              disabled={disabled}
              onConnect={onConnectWhatsApp}
            />

            {/* 8. Add Manually */}
            <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
              <PanelHeader n={8} title="Add Manually" icon={PlusCircle} color="#f97316" />
              <p className="mb-3 text-xs text-neutral-400">
                For TikTok, Pinterest, or any account without real login here yet.
              </p>
              <form onSubmit={onAdd} className="space-y-2">
                <Select value={platform} onChange={(e) => setPlatform(e.target.value as (typeof PLATFORMS)[number])}>
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <Input placeholder="@acmecorp" value={label} onChange={(e) => setLabel(e.target.value)} required />
                <Button type="submit" size="sm" className="w-full" loading={creating} disabled={disabled}>
                  Add
                </Button>
              </form>
            </Card>

            {/* 9. Connected Accounts */}
            <Card padding="lg" className="sm:col-span-2 lg:col-span-2">
              <PanelHeader n={9} title="Connected Accounts" icon={List} color="#14b8a6" />
              {disabled ? (
                <p className="text-xs text-neutral-500">Select a client first.</p>
              ) : accounts === null ? (
                <Skeleton className="h-16 w-full" />
              ) : accounts.length === 0 ? (
                <p className="text-xs text-neutral-500">No accounts connected yet for {selectedClient?.name}.</p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {accounts.map((account) => (
                      <motion.li
                        key={account.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-1.5"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge tone="neutral">{account.platform}</Badge>
                          <span className="truncate text-xs text-neutral-200">{account.label}</span>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => onRemove(account.id)}>
                          Remove
                        </Button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </Card>
          </div>

          {/* Right rail */}
          <div className="space-y-4">
            <Card padding="lg">
              <h2 className="mb-3 text-sm font-semibold text-neutral-50">
                {selectedClient ? `${selectedClient.name} — Accounts` : 'Accounts Overview'}
              </h2>
              <ul className="space-y-1.5 text-xs">
                {PLATFORMS.map((p) => (
                  <li key={p} className="flex items-center justify-between text-neutral-400">
                    <span>{p}</span>
                    <span className="font-medium text-neutral-100">{platformCounts[p]}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-xs font-semibold text-neutral-100">
                <span>Total Connected</span>
                <span>{accounts?.length ?? 0}</span>
              </div>
            </Card>

            <Card padding="lg">
              <h2 className="mb-3 text-sm font-semibold text-neutral-50">Quick Facts</h2>
              <ul className="space-y-1.5 text-xs text-neutral-400">
                <li>
                  Total clients: <span className="font-medium text-neutral-100">{clients?.length ?? 0}</span>
                </li>
                <li>Real login: Instagram, Facebook, LinkedIn, X, YouTube, WhatsApp</li>
                <li>Manual only: TikTok, Pinterest</li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </motion.div>
  );
}
