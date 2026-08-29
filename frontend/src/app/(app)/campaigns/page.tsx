'use client';

import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import { Plus, Trash2 } from 'lucide-react';

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

const STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;
const TABS = ['Overview', 'Platforms', 'Content Ideas', 'Team & Approval', 'Content', 'Report'] as const;
type Tab = (typeof TABS)[number];

const STATUS_TONE: Record<(typeof STATUSES)[number], 'neutral' | 'accent' | 'warning' | 'success'> = {
  DRAFT: 'neutral',
  ACTIVE: 'accent',
  PAUSED: 'warning',
  COMPLETED: 'success',
  ARCHIVED: 'neutral',
};

interface Member {
  id: string;
  name: string;
}

interface ContentIdea {
  label: string;
  done: boolean;
}

interface CampaignSummary {
  id: string;
  name: string;
  objective: string | null;
  goal: string | null;
  kpi: string | null;
  target: number | null;
  platforms: (typeof PLATFORMS)[number][];
  contentIdeas: ContentIdea[] | null;
  assignedTo: Member | null;
  assignedToId: string | null;
  reviewer: Member | null;
  reviewerId: string | null;
  startDate: string | null;
  endDate: string | null;
  status: (typeof STATUSES)[number];
  _count: { contentItems: number; adCampaigns: number };
}

interface CampaignContentItem {
  id: string;
  type: string;
  status: string;
  platforms: string[];
  body: string | null;
}

interface CampaignDetail extends CampaignSummary {
  contentItems: CampaignContentItem[];
}

export default function CampaignsPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Campaigns</h1>
        <p className="text-sm text-neutral-400">From campaign creation to performance tracking.</p>
        <p className="mt-2 text-xs text-amber-300/80">
          Reach, engagement, and ROI numbers aren&apos;t shown here yet — those need real
          platform metrics, which land with the Insights &amp; Analytics module. This page
          tracks real data: goals, platforms, linked content, and its publish status.
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

          {selectedClientId && <CampaignsWorkspace key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}

function CampaignsWorkspace({ clientId }: { clientId: string }) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [active, setActive] = useState<CampaignDetail | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState('');
  const [newIdea, setNewIdea] = useState('');

  function loadCampaigns() {
    api.get<CampaignSummary[]>(`/clients/${clientId}/campaigns`).then(setCampaigns).catch(() => setCampaigns([]));
  }

  useEffect(() => {
    loadCampaigns();
    api.get<Member[]>(`/clients/${clientId}/access`).then(setMembers).catch(() => setMembers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshActive(id: string) {
    const campaign = await api.get<CampaignDetail>(`/clients/${clientId}/campaigns/${id}`);
    setActive(campaign);
    loadCampaigns();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const campaign = await api.post<CampaignSummary>(`/clients/${clientId}/campaigns`, { name: newName });
      setNewName('');
      setActiveTab('Overview');
      await refreshActive(campaign.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create campaign');
    } finally {
      setBusy(false);
    }
  }

  async function patch(data: Record<string, unknown>) {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/clients/${clientId}/campaigns/${active.id}`, data);
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save changes');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    await api.delete(`/clients/${clientId}/campaigns/${id}`);
    if (active?.id === id) setActive(null);
    loadCampaigns();
  }

  function togglePlatform(p: (typeof PLATFORMS)[number]) {
    if (!active) return;
    const next = active.platforms.includes(p)
      ? active.platforms.filter((x) => x !== p)
      : [...active.platforms, p];
    patch({ platforms: next });
  }

  function addIdea() {
    if (!active || !newIdea.trim()) return;
    const next = [...(active.contentIdeas ?? []), { label: newIdea.trim(), done: false }];
    setNewIdea('');
    patch({ contentIdeas: next });
  }

  function toggleIdea(i: number) {
    if (!active?.contentIdeas) return;
    const next = active.contentIdeas.map((idea, idx) => (idx === i ? { ...idea, done: !idea.done } : idea));
    patch({ contentIdeas: next });
  }

  function removeIdea(i: number) {
    if (!active?.contentIdeas) return;
    patch({ contentIdeas: active.contentIdeas.filter((_, idx) => idx !== i) });
  }

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
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Campaigns</h2>
          <div className="space-y-1">
            {campaigns === null ? (
              <Skeleton className="h-10 w-full" />
            ) : campaigns.length === 0 ? (
              <p className="px-2 text-xs text-neutral-500">No campaigns yet.</p>
            ) : (
              campaigns.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-xs ${
                    active?.id === c.id ? 'bg-accent-500/15 text-accent-200' : 'text-neutral-400 hover:bg-white/[0.05]'
                  }`}
                >
                  <button onClick={() => refreshActive(c.id)} className="flex-1 truncate text-left" title={c.name}>
                    {c.name}
                  </button>
                  <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                  <button onClick={() => onDelete(c.id)} className="shrink-0 opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5 text-neutral-500 hover:text-red-400" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-white/10 pt-3">
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              New campaign
            </h2>
            <form onSubmit={onCreate} className="space-y-2 px-1">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Campaign name"
                required
                className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
              />
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
                Select a campaign on the left, or create a new one to get started.
              </p>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === t
                        ? 'border-accent-400/50 bg-accent-500/20 text-accent-200'
                        : 'border-white/12 bg-white/[0.04] text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <Card padding="lg" className="space-y-4">
                {activeTab === 'Overview' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-neutral-50">{active.name}</h3>
                      <Badge tone={STATUS_TONE[active.status]}>{active.status}</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Objective" value={active.objective} onSave={(v) => patch({ objective: v })} />
                      <Field label="Goal type" value={active.goal} onSave={(v) => patch({ goal: v })} />
                      <Field label="KPI" value={active.kpi} onSave={(v) => patch({ kpi: v })} />
                      <Field
                        label="Target"
                        value={active.target?.toString() ?? ''}
                        onSave={(v) => patch({ target: v ? Number(v) : undefined })}
                        type="number"
                      />
                      <Field
                        label="Start date"
                        value={active.startDate?.slice(0, 10) ?? ''}
                        onSave={(v) => patch({ startDate: v || undefined })}
                        type="date"
                      />
                      <Field
                        label="End date"
                        value={active.endDate?.slice(0, 10) ?? ''}
                        onSave={(v) => patch({ endDate: v || undefined })}
                        type="date"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-neutral-300">Status</label>
                      <Select
                        value={active.status}
                        onChange={(e) => patch({ status: e.target.value })}
                        className="max-w-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                )}

                {activeTab === 'Platforms' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">Select platforms</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PLATFORMS.map((p) => (
                        <button
                          key={p}
                          onClick={() => togglePlatform(p)}
                          className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                            active.platforms.includes(p)
                              ? 'border-accent-400/50 bg-accent-500/15 text-accent-200'
                              : 'border-white/12 bg-white/[0.04] text-neutral-400 hover:border-white/20'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'Content Ideas' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">Content ideas</h3>
                    <div className="space-y-2">
                      {(active.contentIdeas ?? []).map((idea, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={idea.done}
                            onChange={() => toggleIdea(i)}
                            className="h-4 w-4 accent-accent-500"
                          />
                          <span className={`flex-1 text-sm ${idea.done ? 'text-neutral-500 line-through' : 'text-neutral-200'}`}>
                            {idea.label}
                          </span>
                          <button onClick={() => removeIdea(i)}>
                            <Trash2 className="h-3.5 w-3.5 text-neutral-500 hover:text-red-400" />
                          </button>
                        </div>
                      ))}
                      {(!active.contentIdeas || active.contentIdeas.length === 0) && (
                        <p className="text-sm text-neutral-400">No content ideas yet.</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newIdea}
                        onChange={(e) => setNewIdea(e.target.value)}
                        placeholder="Add an idea…"
                        className="flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                      />
                      <Button size="sm" onClick={addIdea}>
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'Team & Approval' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">Assign &amp; approve</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-neutral-300">Assign to</label>
                        <Select
                          value={active.assignedToId ?? ''}
                          onChange={(e) => patch({ assignedToId: e.target.value || undefined })}
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-neutral-300">Reviewer</label>
                        <Select
                          value={active.reviewerId ?? ''}
                          onChange={(e) => patch({ reviewerId: e.target.value || undefined })}
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    {active.assignedTo && active.reviewer && (
                      <p className="text-xs text-neutral-400">
                        Flow: {active.assignedTo.name} → {active.reviewer.name} → Client
                      </p>
                    )}
                  </div>
                )}

                {activeTab === 'Content' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">
                      Linked content ({active.contentItems.length})
                    </h3>
                    {active.contentItems.length === 0 ? (
                      <p className="text-sm text-neutral-400">
                        No content linked yet — create items in Content Planner and set this
                        campaign there.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {active.contentItems.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2"
                          >
                            <span className="truncate text-sm text-neutral-300">{item.body || item.type}</span>
                            <Badge tone="neutral">{item.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {activeTab === 'Report' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-50">Goals &amp; progress</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Stat label="Goal type" value={active.goal || '—'} />
                      <Stat label="KPI" value={active.kpi || '—'} />
                      <Stat label="Target" value={active.target?.toLocaleString() ?? '—'} />
                      <Stat label="Content items" value={active._count.contentItems.toString()} />
                    </div>
                    <p className="text-xs text-amber-300/80">
                      Reach, engagement, and ROI figures require a connected analytics
                      provider — coming with the Insights &amp; Analytics module. This report
                      only shows counts CampaignHub actually tracks today.
                    </p>
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
}: {
  label: string;
  value: string | null | undefined;
  onSave: (value: string) => void;
  type?: string;
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
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== (value ?? '') && onSave(draft)}
        className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-50 outline-none focus:border-accent-400"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-100">{value}</p>
    </div>
  );
}
