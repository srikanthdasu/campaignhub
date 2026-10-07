'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { canDeleteCampaigns, Role } from '@/lib/roles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Rocket,
  Target,
  Share2,
  FileText,
  UserCheck,
  CalendarClock,
  Send,
  BarChart3,
  Plus,
  Trash2,
} from 'lucide-react';
import { PanelHeader } from './components/panel-header';
import { Field } from './components/field';
import {
  createCampaign,
  deleteCampaign,
  fetchCampaignDetail,
  fetchCampaigns,
  fetchClientAccess,
  updateCampaign,
} from './api/campaigns-api';
import {
  PLATFORMS,
  STATUSES,
  STATUS_TONE,
  CONTENT_STATUS_TONE,
  type CampaignDetail,
  type CampaignSummary,
  type Member,
} from './types';

export function CampaignsWorkspace({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const canDelete = canDeleteCampaigns(user?.role as Role | undefined);
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [active, setActive] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadCampaigns() {
    fetchCampaigns(clientId).then(setCampaigns).catch(() => setCampaigns([]));
  }

  useEffect(() => {
    loadCampaigns();
    fetchClientAccess(clientId).then(setMembers).catch(() => setMembers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshActive(id: string) {
    const campaign = await fetchCampaignDetail(clientId, id);
    setActive(campaign);
    loadCampaigns();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const campaign = await createCampaign(clientId, {
        name: newName,
        objective: newObjective || undefined,
      });
      setNewName('');
      setNewObjective('');
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
      await updateCampaign(clientId, active.id, data);
      await refreshActive(active.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save changes');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setError(null);
    setDeletingId(id);
    try {
      await deleteCampaign(clientId, id);
      if (active?.id === id) setActive(null);
      setConfirmDeleteId(null);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete campaign');
    } finally {
      setDeletingId(null);
    }
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

  const disabled = !active;
  const activeCount = campaigns?.filter((c) => c.status === 'ACTIVE').length ?? 0;
  const draftCount = campaigns?.filter((c) => c.status === 'DRAFT').length ?? 0;
  const completedCount = campaigns?.filter((c) => c.status === 'COMPLETED').length ?? 0;
  const totalContentItems = campaigns?.reduce((sum, c) => sum + c._count.contentItems, 0) ?? 0;

  const publishedItems = active?.contentItems.filter((i) => i.status === 'PUBLISHED').length ?? 0;
  const scheduledItems = active?.contentItems.filter((i) => i.status === 'SCHEDULED').length ?? 0;
  const pendingItems =
    active?.contentItems.filter((i) => i.status === 'IN_REVIEW' || i.status === 'CHANGES_REQUESTED').length ?? 0;
  const draftItems = active?.contentItems.filter((i) => i.status === 'DRAFT').length ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {error && (
          <p className="col-span-full rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}

        {/* 1. Create Campaign */}
        <Card padding="lg" className="sm:col-span-2 lg:col-span-2">
          <PanelHeader n={1} title="Create Campaign" icon={Rocket} color="#8b5cf6" />
          <form onSubmit={onCreate} className="space-y-2">
            <Input placeholder="Campaign name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <Input
              placeholder="Objective (optional)"
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
            />
            <Button type="submit" size="sm" className="w-full" loading={busy} disabled={!newName.trim()}>
              <Plus className="h-3.5 w-3.5" /> Create
            </Button>
          </form>
          <div className="mt-3 max-h-44 space-y-1 overflow-y-auto border-t border-white/10 pt-3">
            {campaigns === null ? (
              <Skeleton className="h-8 w-full" />
            ) : campaigns.length === 0 ? (
              <p className="px-1 text-[11px] text-neutral-500">No campaigns yet.</p>
            ) : (
              campaigns.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs ${
                    active?.id === c.id ? 'bg-accent-500/15 text-accent-200' : 'text-neutral-400 hover:bg-white/[0.05]'
                  }`}
                >
                  <button onClick={() => refreshActive(c.id)} className="min-w-0 flex-1 truncate text-left" title={c.name}>
                    {c.name}
                  </button>
                  <span className="shrink-0">
                    <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                  </span>
                  {canDelete && (confirmDeleteId === c.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => onDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-400 hover:bg-red-500/10"
                      >
                        {deletingId === c.id ? '…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded px-1.5 py-0.5 text-[10px] text-neutral-400 hover:bg-white/[0.06]"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(c.id)} className="shrink-0 opacity-0 group-hover:opacity-100" title="Delete campaign" aria-label={`Delete ${c.name}`}>
                      <Trash2 className="h-3.5 w-3.5 text-neutral-500 hover:text-red-400" />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 2. Set Goals */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={2} title="Set Goals" icon={Target} color="#0ea5e9" />
          {disabled ? (
            <p className="text-xs text-neutral-500">Select or create a campaign first.</p>
          ) : (
            <div className="space-y-2">
              <Field label="Goal type" value={active.goal} onSave={(v) => patch({ goal: v })} />
              <Field label="KPI" value={active.kpi} onSave={(v) => patch({ kpi: v })} />
              <Field
                label="Target"
                value={active.target?.toString() ?? ''}
                onSave={(v) => patch({ target: v ? Number(v) : undefined })}
                type="number"
              />
            </div>
          )}
        </Card>

        {/* 3. Select Platforms */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={3} title="Select Platforms" icon={Share2} color="#22c55e" />
          {disabled ? (
            <p className="text-xs text-neutral-500">Select or create a campaign first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active.platforms.includes(p)
                      ? 'border-accent-400/40 bg-accent-500/15 text-accent-200'
                      : 'border-white/12 bg-white/[0.03] text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* 4. Plan Content */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={4} title="Plan Content" icon={FileText} color="#f43f5e" />
          {disabled ? (
            <p className="text-xs text-neutral-500">Select or create a campaign first.</p>
          ) : (
            <div className="space-y-2">
              <div className="max-h-32 space-y-1.5 overflow-y-auto">
                {(active.contentIdeas ?? []).map((idea, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={idea.done}
                      onChange={() => toggleIdea(i)}
                      className="h-3.5 w-3.5 accent-accent-500"
                    />
                    <span className={`flex-1 truncate text-xs ${idea.done ? 'text-neutral-500 line-through' : 'text-neutral-300'}`}>
                      {idea.label}
                    </span>
                    <button onClick={() => removeIdea(i)}>
                      <Trash2 className="h-3 w-3 text-neutral-500 hover:text-red-400" />
                    </button>
                  </div>
                ))}
                {(!active.contentIdeas || active.contentIdeas.length === 0) && (
                  <p className="text-[11px] text-neutral-500">No content ideas yet.</p>
                )}
              </div>
              <div className="flex gap-1.5">
                <div className="flex-1">
                  <Input placeholder="Add an idea…" value={newIdea} onChange={(e) => setNewIdea(e.target.value)} />
                </div>
                <Button size="sm" onClick={addIdea}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* 5. Assign & Approve */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={5} title="Assign & Approve" icon={UserCheck} color="#f97316" />
          {disabled ? (
            <p className="text-xs text-neutral-500">Select or create a campaign first.</p>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-400">Assign to</label>
                <Select value={active.assignedToId ?? ''} onChange={(e) => patch({ assignedToId: e.target.value || undefined })}>
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-400">Reviewer</label>
                <Select value={active.reviewerId ?? ''} onChange={(e) => patch({ reviewerId: e.target.value || undefined })}>
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
              {active.assignedTo && active.reviewer && (
                <p className="text-[11px] text-neutral-500">
                  Flow: {active.assignedTo.name} → {active.reviewer.name} → Client
                </p>
              )}
            </div>
          )}
        </Card>

        {/* 6. Schedule Content */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={6} title="Schedule Content" icon={CalendarClock} color="#14b8a6" />
          {disabled ? (
            <p className="text-xs text-neutral-500">Select or create a campaign first.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-neutral-500">
                Total linked posts: <span className="font-semibold text-neutral-200">{active._count.contentItems}</span>
              </p>
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
          )}
        </Card>

        {/* 7. Publish */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={7} title="Publish" icon={Send} color="#d946ef" />
          {disabled ? (
            <p className="text-xs text-neutral-500">Select or create a campaign first.</p>
          ) : active.contentItems.length === 0 ? (
            <p className="text-xs text-neutral-500">
              No content linked yet — create it in Content Planner and pick this campaign there.
            </p>
          ) : (
            <ul className="max-h-52 space-y-1.5 overflow-y-auto">
              {active.contentItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2 py-1.5">
                  <span className="truncate text-xs text-neutral-300">{item.body || item.type}</span>
                  <Badge tone={CONTENT_STATUS_TONE[item.status] ?? 'neutral'}>{item.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 border-t border-white/10 pt-2">
            <label className="mb-1 block text-[11px] font-medium text-neutral-400">Status</label>
            <Select value={active?.status ?? 'DRAFT'} onChange={(e) => patch({ status: e.target.value })} disabled={disabled}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        {/* 8. Analyze & Report */}
        <Card padding="lg" className={disabled ? 'opacity-50' : ''}>
          <PanelHeader n={8} title="Analyze & Report" icon={BarChart3} color="#eab308" />
          {disabled ? (
            <p className="text-xs text-neutral-500">Select or create a campaign first.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] py-2">
                  <p className="text-base font-semibold text-neutral-100">{publishedItems}</p>
                  <p className="text-neutral-500">Published</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] py-2">
                  <p className="text-base font-semibold text-neutral-100">{scheduledItems}</p>
                  <p className="text-neutral-500">Scheduled</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] py-2">
                  <p className="text-base font-semibold text-neutral-100">{pendingItems}</p>
                  <p className="text-neutral-500">Pending</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] py-2">
                  <p className="text-base font-semibold text-neutral-100">{draftItems}</p>
                  <p className="text-neutral-500">Drafts</p>
                </div>
              </div>
              <p className="text-[11px] text-neutral-500">
                Goal: {active.goal || '—'} · KPI: {active.kpi || '—'} · Target: {active.target?.toLocaleString() ?? '—'}
              </p>
              <p className="text-[11px] text-amber-300/80">
                Reach, engagement, and ROI need a connected analytics provider — not available yet.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Right rail */}
      <div className="space-y-4">
        <Card padding="lg">
          <h2 className="mb-3 text-sm font-semibold text-neutral-50">Campaign Overview</h2>
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-center justify-between text-neutral-400">
              <span>Active Campaigns</span>
              <span className="font-medium text-neutral-100">{activeCount}</span>
            </li>
            <li className="flex items-center justify-between text-neutral-400">
              <span>Draft Campaigns</span>
              <span className="font-medium text-neutral-100">{draftCount}</span>
            </li>
            <li className="flex items-center justify-between text-neutral-400">
              <span>Completed</span>
              <span className="font-medium text-neutral-100">{completedCount}</span>
            </li>
            <li className="flex items-center justify-between text-neutral-400">
              <span>Linked Content Items</span>
              <span className="font-medium text-neutral-100">{totalContentItems}</span>
            </li>
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-xs font-semibold text-neutral-100">
            <span>Total Campaigns</span>
            <span>{campaigns?.length ?? 0}</span>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="mb-3 text-sm font-semibold text-neutral-50">Quick Actions</h2>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/content-planner" className="font-medium text-accent-300 hover:underline">
                Create Content →
              </Link>
            </li>
            <li>
              <Link href="/scheduler" className="font-medium text-accent-300 hover:underline">
                Campaign Calendar →
              </Link>
            </li>
            <li>
              <Link href="/reports" className="font-medium text-accent-300 hover:underline">
                Campaign Report →
              </Link>
            </li>
            <li>
              <Link href="/approvals" className="font-medium text-accent-300 hover:underline">
                Approval Queue →
              </Link>
            </li>
          </ul>
        </Card>

        {campaigns === null && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        )}
      </div>
    </div>
  );
}
