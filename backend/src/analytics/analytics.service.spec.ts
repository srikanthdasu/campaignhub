import { describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service.js';
import { ApprovalFlowStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function buildService(approvalFlows: any[]) {
  const prisma = {
    contentItem: { groupBy: vi.fn(() => Promise.resolve([{ status: 'DRAFT', _count: 3 }])) },
    campaign: { groupBy: vi.fn(() => Promise.resolve([{ status: 'ACTIVE', _count: 2 }])) },
    adCampaign: {
      groupBy: vi.fn(() => Promise.resolve([{ status: 'LIVE', _count: 1 }])),
      aggregate: vi.fn(() => Promise.resolve({ _sum: { budgetAmount: 500 } })),
    },
    aiConversation: { count: vi.fn(() => Promise.resolve(4)) },
    aiCaption: { count: vi.fn(() => Promise.resolve(5)) },
    aiVideoProject: { count: vi.fn(() => Promise.resolve(1)) },
    aiStrategyRequest: { count: vi.fn(() => Promise.resolve(2)) },
    socialAccount: { count: vi.fn(() => Promise.resolve(3)) },
    scheduledPost: { groupBy: vi.fn(() => Promise.resolve([{ status: 'PENDING', _count: 6 }])) },
    approvalFlow: { findMany: vi.fn(() => Promise.resolve(approvalFlows)) },
  };
  return new AnalyticsService(prisma as unknown as PrismaService);
}

function flow(status: ApprovalFlowStatus, createdAt: Date, decidedAt: Date | null) {
  return {
    status,
    createdAt,
    steps: decidedAt ? [{ decidedAt }] : [],
  };
}

describe('AnalyticsService.getOverview', () => {
  it('classifies flows into pending/approved/rejected buckets', async () => {
    const flows = [
      flow(ApprovalFlowStatus.IN_REVIEW, new Date(), null),
      flow(ApprovalFlowStatus.SUBMITTED, new Date(), null),
      flow(ApprovalFlowStatus.APPROVED, new Date(), new Date()),
      flow(ApprovalFlowStatus.REJECTED, new Date(), null),
    ];
    const overview = await buildService(flows).getOverview('client-1');

    expect(overview.approvals.total).toBe(4);
    expect(overview.approvals.pending).toBe(2);
    expect(overview.approvals.approved).toBe(1);
    expect(overview.approvals.rejected).toBe(1);
  });

  it('computes the average approval resolution time in hours from createdAt to the last decision', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const decidedAt = new Date('2026-01-01T06:00:00Z'); // 6h later
    const flows = [flow(ApprovalFlowStatus.APPROVED, createdAt, decidedAt)];

    const overview = await buildService(flows).getOverview('client-1');
    expect(overview.approvals.avgResolutionHours).toBe(6);
  });

  it('returns null resolution time when no flow has been decided yet', async () => {
    const flows = [flow(ApprovalFlowStatus.IN_REVIEW, new Date(), null)];
    const overview = await buildService(flows).getOverview('client-1');
    expect(overview.approvals.avgResolutionHours).toBeNull();
  });

  it('converts groupBy rows into a status->count map', async () => {
    const overview = await buildService([]).getOverview('client-1');
    expect(overview.content.byStatus).toEqual({ DRAFT: 3 });
    expect(overview.campaigns.byStatus).toEqual({ ACTIVE: 2 });
  });

  it('defaults total ad budget to 0 when there is no aggregate sum', async () => {
    const service = buildService([]);
    // Override the aggregate mock for this one case
    (service as any).prisma.adCampaign.aggregate = vi.fn(() => Promise.resolve({ _sum: { budgetAmount: null } }));
    const overview = await service.getOverview('client-1');
    expect(overview.ads.totalBudget).toBe(0);
  });
});
