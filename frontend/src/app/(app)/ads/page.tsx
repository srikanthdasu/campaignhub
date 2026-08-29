'use client';

import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { Plus, Rocket, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';

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

const STEPS = [
  { key: 'BRIEF', label: 'Brief' },
  { key: 'AUDIENCE_BUDGET', label: 'Audience / Budget' },
  { key: 'CREATIVE', label: 'Creative' },
  { key: 'APPROVAL', label: 'Approval' },
  { key: 'LAUNCH', label: 'Launch' },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

type Status = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'LAUNCHED' | 'PAUSED' | 'COMPLETED';

const STATUS_TONE: Record<Status, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'accent',
  APPROVED: 'success',
  REJECTED: 'danger',
  LAUNCHED: 'success',
  PAUSED: 'warning',
  COMPLETED: 'neutral',
};

const CAN_APPROVE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];
const EDITABLE_STATUSES: Status[] = ['DRAFT', 'REJECTED'];

interface AdCampaign {
  id: string;
  name: string;
  objective: string | null;
  platform: (typeof PLATFORMS)[number];
  audienceNotes: string | null;
  budgetAmount: number | null;
  budgetCurrency: string;
  creativeText: string | null;
  status: Status;
  approvedAt: string | null;
  launchedAt: string | null;
  updatedAt: string;
}

function maxReachable(status: Status): number {
  if (status === 'APPROVED' || status === 'LAUNCHED' || status === 'PAUSED' || status === 'COMPLETED') return 5;
  return 4;
}

export default function AdsPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Ads &amp; Paid Campaigns</h1>
        <p className="text-sm text-neutral-400">
          Paid campaigns launch only after budget, permission, and platform validation.
        </p>
        <p className="mt-2 text-xs text-amber-300/80">
          No Meta / Google / TikTok Ads API credentials are configured yet, so Launch marks the
          record launched rather than placing a real paid ad buy — the Approval gate itself is
          fully enforced regardless.
        </p>
      </motion.div>

      {clients && clients.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-neutral-400">No clients yet — create one from Agency &amp; Clients first.</p>
        </Card>
      ) : (
        <>
          {clients && (
            <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
              <ClientPicker clients={clients} value={selectedClientId} onChange={setSelectedClientId} />
            </motion.div>
          )}

          {selectedClientId && <AdsWorkspace key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}

function AdsWorkspace({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const canApprove = !!user && CAN_APPROVE_ROLES.includes(user.role);
  const [ads, setAds] = useState<AdCampaign[] | null>(null);
  const [active, setActive] = useState<AdCampaign | null>(null);
  const [activeTab, setActiveTab] = useState<StepKey>('BRIEF');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState('');
  const [newPlatform, setNewPlatform] = useState<(typeof PLATFORMS)[number]>('INSTAGRAM');

  function loadAds() {
    api.get<AdCampaign[]>(`/clients/${clientId}/ads`).then(setAds).catch(() => setAds([]));
  }

  useEffect(() => {
    loadAds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshActive(id: string) {
    const ad = await api.get<AdCampaign>(`/clients/${clientId}/ads/${id}`);
    setActive(ad);
    setActiveTab((prev) => {
      const currentIndex = STEPS.findIndex((s) => s.key === prev);
      return currentIndex >= 0 && currentIndex < maxReachable(ad.status) ? prev : 'BRIEF';
    });
    loadAds();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const ad = await api.post<AdCampaign>(`/clients/${clientId}/ads`, {
        name: newName,
        platform: newPlatform,
      });
      setNewName('');
      setActiveTab('BRIEF');
      await refreshActive(ad.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create ad');
    } finally {
      setBusy(false);
    }
  }

  async function patch(data: Record<string, unknown>) {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/clients/${clientId}/ads/${active.id}`, data);
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save changes');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/clients/${clientId}/ads/${active.id}/submit`);
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit for approval');
    } finally {
      setBusy(false);
    }
  }

  async function onReview(status: 'APPROVED' | 'REJECTED') {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/clients/${clientId}/ads/${active.id}/review`, { status });
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit review');
    } finally {
      setBusy(false);
    }
  }

  async function onLaunch() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/clients/${clientId}/ads/${active.id}/launch`);
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to launch');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    await api.delete(`/clients/${clientId}/ads/${id}`);
    if (active?.id === id) setActive(null);
    loadAds();
  }

  const editable = active ? EDITABLE_STATUSES.includes(active.status) : false;
  const reach = active ? maxReachable(active.status) : 0;

  return (
    <>
      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: DURATION.base, ease: EASE_SOFT }}
        className="mt-4 grid grid-cols-[260px_1fr] gap-4"
      >
        <Card padding="sm" className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Ads</h2>
          <div className="space-y-1">
            {ads === null ? (
              <Skeleton className="h-10 w-full" />
            ) : ads.length === 0 ? (
              <p className="px-2 text-xs text-neutral-500">No ads yet.</p>
            ) : (
              ads.map((a) => (
                <div
                  key={a.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-xs ${
                    active?.id === a.id ? 'bg-accent-500/15 text-accent-200' : 'text-neutral-400 hover:bg-white/[0.05]'
                  }`}
                >
                  <button onClick={() => refreshActive(a.id)} className="flex-1 truncate text-left" title={a.name}>
                    {a.name}
                  </button>
                  <Badge tone={STATUS_TONE[a.status]}>{a.status.replace('_', ' ')}</Badge>
                  {a.status === 'DRAFT' && (
                    <button onClick={() => onDelete(a.id)} className="shrink-0 opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5 text-neutral-500 hover:text-red-400" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-white/10 pt-3">
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">New ad</h2>
            <form onSubmit={onCreate} className="space-y-2 px-1">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ad name"
                required
                className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
              />
              <select
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value as (typeof PLATFORMS)[number])}
                className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-xs text-neutral-50 outline-none focus:border-accent-400 [&>option]:bg-neutral-900"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" className="w-full" loading={busy}>
                <Plus className="h-3.5 w-3.5" /> Create
              </Button>
            </form>
          </div>
        </Card>

        <div className="space-y-4">
          {!active ? (
            <Card padding="lg">
              <p className="text-sm text-neutral-400">
                Select an ad on the left, or create a new one to start the brief.
              </p>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {STEPS.map((s, i) => (
                  <button
                    key={s.key}
                    disabled={i >= reach}
                    onClick={() => setActiveTab(s.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      activeTab === s.key
                        ? 'border-accent-400/50 bg-accent-500/20 text-accent-200'
                        : 'border-white/12 bg-white/[0.04] text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {i + 1}. {s.label}
                  </button>
                ))}
              </div>

              <Card padding="lg" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-neutral-50">{active.name}</h3>
                  <Badge tone={STATUS_TONE[active.status]}>{active.status.replace('_', ' ')}</Badge>
                </div>

                {activeTab === 'BRIEF' && (
                  <div className="space-y-3">
                    <Field
                      label="Ad name"
                      value={active.name}
                      disabled={!editable}
                      onSave={(v) => patch({ name: v })}
                    />
                    <Field
                      label="Objective"
                      value={active.objective}
                      disabled={!editable}
                      onSave={(v) => patch({ objective: v })}
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-neutral-300">Platform</label>
                      <Select
                        value={active.platform}
                        disabled={!editable}
                        onChange={(e) => patch({ platform: e.target.value })}
                        className="max-w-xs"
                      >
                        {PLATFORMS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                )}

                {activeTab === 'AUDIENCE_BUDGET' && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-neutral-300">Audience notes</label>
                      <textarea
                        defaultValue={active.audienceNotes ?? ''}
                        disabled={!editable}
                        onBlur={(e) => e.target.value !== (active.audienceNotes ?? '') && patch({ audienceNotes: e.target.value })}
                        rows={3}
                        placeholder="Who should this reach? e.g. Women 25-40, US, interested in fitness"
                        className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400 disabled:opacity-50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Budget amount"
                        value={active.budgetAmount?.toString() ?? ''}
                        disabled={!editable}
                        type="number"
                        onSave={(v) => patch({ budgetAmount: v ? Number(v) : undefined })}
                      />
                      <Field
                        label="Currency"
                        value={active.budgetCurrency}
                        disabled={!editable}
                        onSave={(v) => patch({ budgetCurrency: v })}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'CREATIVE' && (
                  <div className="space-y-3">
                    <label className="mb-1.5 block text-sm font-medium text-neutral-300">Ad copy</label>
                    <textarea
                      defaultValue={active.creativeText ?? ''}
                      disabled={!editable}
                      onBlur={(e) => e.target.value !== (active.creativeText ?? '') && patch({ creativeText: e.target.value })}
                      rows={4}
                      placeholder="Write the ad copy…"
                      className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400 disabled:opacity-50"
                    />
                  </div>
                )}

                {activeTab === 'APPROVAL' && (
                  <div className="space-y-3">
                    {active.status === 'DRAFT' && (
                      <>
                        <p className="text-sm text-neutral-400">
                          Submit for approval once the budget and creative are set.
                        </p>
                        <Button
                          size="sm"
                          onClick={onSubmit}
                          loading={busy}
                          disabled={!active.budgetAmount || !active.creativeText}
                        >
                          Submit for Approval
                        </Button>
                      </>
                    )}
                    {active.status === 'PENDING_APPROVAL' &&
                      (canApprove ? (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => onReview('APPROVED')} loading={busy}>
                            <ThumbsUp className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => onReview('REJECTED')} loading={busy}>
                            <ThumbsDown className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-400">
                          Waiting on an Owner, Admin, or Manager to review budget and permission.
                        </p>
                      ))}
                    {active.status === 'REJECTED' && (
                      <p className="text-sm text-neutral-400">
                        Rejected — edit the Brief, Audience/Budget, or Creative and resubmit.
                      </p>
                    )}
                    {(active.status === 'APPROVED' ||
                      active.status === 'LAUNCHED' ||
                      active.status === 'PAUSED' ||
                      active.status === 'COMPLETED') && (
                      <p className="text-sm text-emerald-300">
                        Approved{active.approvedAt ? ` on ${new Date(active.approvedAt).toLocaleString()}` : ''}.
                      </p>
                    )}
                  </div>
                )}

                {activeTab === 'LAUNCH' && (
                  <div className="space-y-3">
                    {active.launchedAt ? (
                      <Badge tone="success">Launched {new Date(active.launchedAt).toLocaleString()}</Badge>
                    ) : (
                      <>
                        <p className="text-sm text-neutral-400">
                          Budget, permission, and platform validation are all confirmed. Ready to launch.
                        </p>
                        <Button size="sm" onClick={onLaunch} loading={busy} disabled={!canApprove}>
                          <Rocket className="h-3.5 w-3.5" /> Launch
                        </Button>
                        {!canApprove && (
                          <p className="text-xs text-neutral-500">
                            Only an Owner, Admin, or Manager can launch a paid campaign.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}

function Field({
  label,
  value,
  onSave,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string | null | undefined;
  onSave: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value ?? '');
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-300">{label}</label>
      <input
        type={type}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== (value ?? '') && onSave(draft)}
        className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none focus:border-accent-400 disabled:opacity-50"
      />
    </div>
  );
}
