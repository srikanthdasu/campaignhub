'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useClientPicker } from '@/hooks/use-client-picker';
import { ClientPicker } from '@/components/client-picker';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp, staggerContainer } from '@/lib/motion';

interface Overview {
  content: { byStatus: Record<string, number> };
  campaigns: { byStatus: Record<string, number> };
  ads: { byStatus: Record<string, number>; totalBudget: number };
  scheduledPosts: { byStatus: Record<string, number> };
  approvals: { total: number; pending: number; approved: number; rejected: number; avgResolutionHours: number | null };
  aiUsage: { conversations: number; captionsSaved: number; videoProjects: number; strategyRequests: number };
  socialAccounts: { total: number };
}

function sum(byStatus: Record<string, number>): number {
  return Object.values(byStatus).reduce((a, b) => a + b, 0);
}

export default function AnalyticsPage() {
  const { clients, selectedClientId, setSelectedClientId } = useClientPicker();

  return (
    <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} transition={{ duration: DURATION.base, ease: EASE_SOFT }}>
        <h1 className="text-2xl font-semibold text-neutral-50">Analytics</h1>
        <p className="text-sm text-neutral-400">Collect. Analyze. Understand. Optimize.</p>
        <p className="mt-2 text-xs text-amber-300/80">
          Reach, impressions, and engagement need a connected platform analytics API — not
          available since Social Accounts are added manually (Phase 3). Every number below is a
          real count from CampaignHub&apos;s own data, not a platform metric.
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

          {selectedClientId && <AnalyticsOverview key={selectedClientId} clientId={selectedClientId} />}
        </>
      )}
    </motion.div>
  );
}

function AnalyticsOverview({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api.get<Overview>(`/clients/${clientId}/analytics/overview`).then(setData);
  }, [clientId]);

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ duration: DURATION.base, ease: EASE_SOFT }}
      className="space-y-6"
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Content items" value={sum(data.content.byStatus)} />
        <Stat label="Campaigns" value={sum(data.campaigns.byStatus)} />
        <Stat label="Ads" value={sum(data.ads.byStatus)} />
        <Stat label="Ad budget" value={`₹${data.ads.totalBudget.toLocaleString('en-IN')}`} />
        <Stat label="Scheduled posts" value={sum(data.scheduledPosts.byStatus)} />
        <Stat label="Social accounts" value={data.socialAccounts.total} />
        <Stat label="Pending approvals" value={data.approvals.pending} />
        <Stat
          label="Avg. approval time"
          value={data.approvals.avgResolutionHours !== null ? `${data.approvals.avgResolutionHours}h` : '—'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card padding="lg">
          <h3 className="mb-3 text-sm font-semibold text-neutral-50">Content by status</h3>
          <BreakdownList data={data.content.byStatus} />
        </Card>
        <Card padding="lg">
          <h3 className="mb-3 text-sm font-semibold text-neutral-50">Campaigns by status</h3>
          <BreakdownList data={data.campaigns.byStatus} />
        </Card>
        <Card padding="lg">
          <h3 className="mb-3 text-sm font-semibold text-neutral-50">Ads by status</h3>
          <BreakdownList data={data.ads.byStatus} />
        </Card>
        <Card padding="lg">
          <h3 className="mb-3 text-sm font-semibold text-neutral-50">Approvals</h3>
          <BreakdownList
            data={{
              approved: data.approvals.approved,
              rejected: data.approvals.rejected,
              pending: data.approvals.pending,
            }}
          />
        </Card>
      </div>

      <Card padding="lg">
        <h3 className="mb-3 text-sm font-semibold text-neutral-50">AI Studio usage</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Assistant chats" value={data.aiUsage.conversations} small />
          <Stat label="Captions saved" value={data.aiUsage.captionsSaved} small />
          <Stat label="Video projects" value={data.aiUsage.videoProjects} small />
          <Stat label="Strategy requests" value={data.aiUsage.strategyRequests} small />
        </div>
      </Card>
    </motion.div>
  );
}

function Stat({ label, value, small = false }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={small ? 'mt-1 text-lg font-semibold text-neutral-100' : 'mt-1 text-2xl font-bold text-neutral-50'}>
        {value}
      </p>
    </div>
  );
}

function BreakdownList({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return <p className="text-sm text-neutral-500">No data yet.</p>;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="space-y-2">
      {entries.map(([status, count]) => (
        <div key={status} className="flex items-center gap-3 text-xs">
          <span className="w-32 shrink-0 text-neutral-400">{status.replace('_', ' ')}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-400 to-fuchsia-500"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-neutral-300">{count}</span>
        </div>
      ))}
    </div>
  );
}
