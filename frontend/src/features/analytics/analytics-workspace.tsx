'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DURATION, EASE_SOFT, fadeUp } from '@/lib/motion';
import type { Overview } from './types';
import { fetchAnalyticsOverview } from './api/analytics-api';
import { sum } from './utils';
import { Stat } from './components/stat';
import { BreakdownList } from './components/breakdown-list';

export function AnalyticsOverview({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    fetchAnalyticsOverview(clientId).then(setData);
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
