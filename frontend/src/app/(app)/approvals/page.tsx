'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api, ApiError, resolveMediaUrl } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { isAgencyAdmin, Role } from '@/lib/roles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  ListChecks,
  FileSearch,
  CheckSquare,
  History,
  type LucideIcon,
} from 'lucide-react';

const FLOW_TONE: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  SUBMITTED: 'accent',
  IN_REVIEW: 'accent',
  CHANGES_REQUESTED: 'warning',
  RE_SUBMITTED: 'accent',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'success',
};

const UNRESOLVED_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'RE_SUBMITTED'];
const STATUS_ORDER = ['SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'RE_SUBMITTED', 'APPROVED', 'REJECTED'] as const;

interface Step {
  id: string;
  approverId: string | null;
  approver: { id: string; name: string } | null;
  stepOrder: number | null;
  decision: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
  comment: string | null;
  decidedAt: string | null;
}

interface Flow {
  id: string;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  status: string;
  dueDate: string | null;
  createdAt: string;
  contentItem: {
    id: string;
    type: string;
    body: string | null;
    client: { name: string };
    campaign: { id: string; name: string } | null;
    createdBy: { id: string; name: string } | null;
    mediaAsset: { id: string; storageUrl: string; fileName: string } | null;
  };
  steps: Step[];
}

interface ActivityEntry {
  id: string;
  action: string;
  entityType: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}

function humanizeAction(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
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

export default function ApprovalsPage() {
  const { user } = useAuth();
  const admin = isAgencyAdmin(user?.role as Role | undefined);

  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  function load() {
    api
      .get<Flow[]>('/approvals')
      .then(setFlows)
      .catch(() => setFlows([]));
  }

  useEffect(load, []);

  function loadActivity() {
    if (!admin) return;
    api
      .get<ActivityEntry[]>('/audit-logs')
      .then((logs) =>
        setActivity(
          logs.filter((l) => l.action.startsWith('APPROVAL_') || l.action.includes('SUBMITTED_FOR_APPROVAL')).slice(0, 10),
        ),
      )
      .catch(() => setActivity([]));
  }

  useEffect(loadActivity, [admin]);

  function myPendingStep(flow: Flow): Step | undefined {
    if (!user) return undefined;
    if (flow.mode === 'SEQUENTIAL') {
      const nextPending = [...flow.steps]
        .filter((s) => s.decision === 'PENDING')
        .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))[0];
      return nextPending?.approverId === user.id ? nextPending : undefined;
    }
    return flow.steps.find((s) => s.approverId === user.id && s.decision === 'PENDING');
  }

  async function decide(flowId: string, stepId: string, decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED') {
    setError(null);
    try {
      await api.post(`/approvals/${flowId}/steps/${stepId}/decide`, { decision, comment: comment || undefined });
      setComment('');
      load();
      loadActivity();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record decision');
    }
  }

  const active = flows?.find((f) => f.id === activeId) ?? null;
  const myFlows = flows?.filter((f) => myPendingStep(f)) ?? [];
  const overdueFlows =
    flows?.filter((f) => f.dueDate && new Date(f.dueDate) < new Date() && UNRESOLVED_STATUSES.includes(f.status)) ?? [];
  const statusCounts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = flows?.filter((f) => f.status === s).length ?? 0;
    return acc;
  }, {});
  const filteredFlows =
    statusFilter === 'ALL' ? flows ?? [] : statusFilter === 'OVERDUE' ? overdueFlows : (flows ?? []).filter((f) => f.status === statusFilter);
  const activeMyStep = active ? myPendingStep(active) : undefined;

  return (
    <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="max-w-[1500px] space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Approvals</h1>
        <p className="text-sm text-neutral-400">Streamlined approvals — content submitted for review, yours to decide or your agency&apos;s in flight.</p>
        <p className="mt-1 text-xs text-amber-300/80">
          Not built yet: email/Slack/Teams notifications, automatic reminders for overdue
          approvals, bulk approve/reject, and version history. In-app notifications (the bell
          icon) already work for real.
        </p>
      </motion.div>

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Approval Summary */}
          <Card padding="lg">
            <PanelHeader n={1} title="Approval Summary" icon={ClipboardList} color="#6366f1" />
            {flows === null ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <ul className="space-y-1.5 text-xs">
                {STATUS_ORDER.map((s) => (
                  <li key={s} className="flex items-center justify-between text-neutral-400">
                    <span>{s.replace('_', ' ')}</span>
                    <span className="font-medium text-neutral-100">{statusCounts[s]}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between text-red-400">
                  <span>Overdue</span>
                  <span className="font-medium">{overdueFlows.length}</span>
                </li>
                <li className="flex items-center justify-between border-t border-white/10 pt-1.5 font-semibold text-neutral-100">
                  <span>Total</span>
                  <span>{flows.length}</span>
                </li>
              </ul>
            )}
          </Card>

          {/* 2. Pending Approvals (Mine) */}
          <Card padding="lg">
            <PanelHeader n={2} title="Pending (Mine)" icon={Clock} color="#f59e0b" />
            {flows === null ? (
              <Skeleton className="h-32 w-full" />
            ) : myFlows.length === 0 ? (
              <p className="text-xs text-neutral-500">Nothing waiting on you right now.</p>
            ) : (
              <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {myFlows.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => setActiveId(f.id)}
                      className={`w-full min-w-0 rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                        activeId === f.id ? 'border-accent-400/40 bg-accent-500/15 text-accent-200' : 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="truncate block">{f.contentItem.body || f.contentItem.type}</span>
                      <span className="text-[10px] text-neutral-500">{timeAgo(f.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* 3. Overdue */}
          <Card padding="lg">
            <PanelHeader n={3} title="Overdue" icon={AlertTriangle} color="#ef4444" />
            {flows === null ? (
              <Skeleton className="h-32 w-full" />
            ) : overdueFlows.length === 0 ? (
              <p className="text-xs text-neutral-500">Nothing overdue.</p>
            ) : (
              <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {overdueFlows.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => setActiveId(f.id)}
                      className={`w-full min-w-0 rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                        activeId === f.id ? 'border-red-400/40 bg-red-500/15 text-red-200' : 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="truncate block">{f.contentItem.body || f.contentItem.type}</span>
                      <span className="text-[10px] text-red-400">Due {new Date(f.dueDate!).toLocaleDateString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* 4. All Approvals */}
          <Card padding="lg">
            <PanelHeader n={4} title="All Approvals" icon={ListChecks} color="#0ea5e9" />
            <div className="mb-2 flex flex-wrap gap-1">
              {['ALL', ...STATUS_ORDER, 'OVERDUE'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    statusFilter === s ? 'border-accent-400/40 bg-accent-500/15 text-accent-200' : 'border-white/12 bg-white/[0.03] text-neutral-400'
                  }`}
                >
                  {s === 'ALL' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
            {flows === null ? (
              <Skeleton className="h-32 w-full" />
            ) : filteredFlows.length === 0 ? (
              <p className="text-xs text-neutral-500">Nothing here.</p>
            ) : (
              <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                {filteredFlows.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => setActiveId(f.id)}
                      className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                        activeId === f.id ? 'border-accent-400/40 bg-accent-500/15 text-accent-200' : 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="truncate">{f.contentItem.body || f.contentItem.type}</span>
                      <Badge tone={FLOW_TONE[f.status] ?? 'neutral'}>{f.status}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* 5. Approval Details */}
          <Card padding="lg" className="sm:col-span-2">
            <PanelHeader n={5} title="Approval Details" icon={FileSearch} color="#d946ef" />
            {!active ? (
              <p className="text-xs text-neutral-500">Select an approval from any panel above.</p>
            ) : (
              <div className="flex gap-3">
                {active.contentItem.mediaAsset && (
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveMediaUrl(active.contentItem.mediaAsset.storageUrl)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1 text-xs">
                  <p className="text-neutral-200">{active.contentItem.body || active.contentItem.type}</p>
                  <p className="text-neutral-500">Client: {active.contentItem.client.name}</p>
                  <p className="text-neutral-500">Campaign: {active.contentItem.campaign?.name ?? '—'}</p>
                  <p className="text-neutral-500">Creator: {active.contentItem.createdBy?.name ?? '—'}</p>
                  <p className="text-neutral-500">Submitted: {new Date(active.createdAt).toLocaleString()}</p>
                  <p className="text-neutral-500">Due: {active.dueDate ? new Date(active.dueDate).toLocaleDateString() : '—'}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone={FLOW_TONE[active.status] ?? 'neutral'}>{active.status}</Badge>
                    <span className="text-neutral-500">{active.mode}</span>
                  </div>
                  <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                    {active.steps.map((s) => (
                      <p key={s.id} className="text-[11px] text-neutral-400">
                        {s.approver?.name ?? 'Unassigned'}: <span className="font-medium text-neutral-200">{s.decision}</span>
                        {s.decidedAt && ` · ${new Date(s.decidedAt).toLocaleString()}`}
                        {s.comment && ` — "${s.comment}"`}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* 6. Take Action */}
          <Card padding="lg" className="sm:col-span-2">
            <PanelHeader n={6} title="Take Action" icon={CheckSquare} color="#22c55e" />
            {!active ? (
              <p className="text-xs text-neutral-500">Select an approval above.</p>
            ) : !activeMyStep ? (
              <p className="text-xs text-neutral-500">
                {active.status === 'APPROVED' || active.status === 'REJECTED'
                  ? 'This approval is already resolved.'
                  : 'You are not the current approver for this item.'}
              </p>
            ) : (
              <div className="space-y-2">
                <input
                  placeholder="Add a comment (optional)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-accent-400"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(active.id, activeMyStep.id, 'APPROVED')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => decide(active.id, activeMyStep.id, 'CHANGES_REQUESTED')}>
                    Request Changes
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => decide(active.id, activeMyStep.id, 'REJECTED')}>
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* 7. Activity Log */}
          <Card padding="lg" className="sm:col-span-2 lg:col-span-4">
            <PanelHeader n={7} title="Activity Log" icon={History} color="#eab308" />
            {!admin ? (
              <p className="text-xs text-neutral-500">Only Owners and Admins can view the agency-wide activity log.</p>
            ) : activity === null ? (
              <Skeleton className="h-16 w-full" />
            ) : activity.length === 0 ? (
              <p className="text-xs text-neutral-500">No approval activity yet.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                {activity.map((a) => (
                  <li key={a.id} className="text-neutral-400">
                    {humanizeAction(a.action)}
                    {a.user && <span className="text-neutral-500"> · {a.user.name}</span>}
                    <span className="text-neutral-600"> · {timeAgo(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Card padding="lg">
            <h2 className="mb-3 text-sm font-semibold text-neutral-50">Quick Actions</h2>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/content-planner" className="font-medium text-accent-300 hover:underline">
                  Submit New Content →
                </Link>
              </li>
              <li>
                <button onClick={() => setStatusFilter('ALL')} className="font-medium text-accent-300 hover:underline">
                  View All Approvals →
                </button>
              </li>
            </ul>
          </Card>

          <Card padding="lg">
            <h2 className="mb-3 text-sm font-semibold text-neutral-50">Not Built Yet</h2>
            <ul className="space-y-1 text-[11px] text-neutral-500">
              <li>Email / Slack / Teams notifications</li>
              <li>Automatic overdue reminders</li>
              <li>Bulk approve / reject</li>
              <li>Version history & compare</li>
              <li>Cloud drive integrations</li>
            </ul>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
