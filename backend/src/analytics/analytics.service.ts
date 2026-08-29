import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApprovalFlowStatus } from '../generated/prisma/client.js';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Real, derived-from-CampaignHub's-own-data metrics only — no reach/engagement/impression
   * numbers, since no social platform is actually connected (Social Accounts are manual per
   * Phase 3) and fabricating those would be misleading. Everything below is a genuine count or
   * average computed from rows this client actually has.
   */
  async getOverview(clientId: string) {
    const [
      contentByStatus,
      campaignsByStatus,
      adsByStatus,
      adsBudget,
      aiConversations,
      aiCaptions,
      aiVideoProjects,
      aiStrategyRequests,
      socialAccounts,
      scheduledPostsByStatus,
      approvalFlows,
    ] = await Promise.all([
      this.prisma.contentItem.groupBy({ by: ['status'], where: { clientId }, _count: true }),
      this.prisma.campaign.groupBy({ by: ['status'], where: { clientId }, _count: true }),
      this.prisma.adCampaign.groupBy({ by: ['status'], where: { clientId }, _count: true }),
      this.prisma.adCampaign.aggregate({ where: { clientId }, _sum: { budgetAmount: true } }),
      this.prisma.aiConversation.count({ where: { clientId } }),
      this.prisma.aiCaption.count({ where: { clientId } }),
      this.prisma.aiVideoProject.count({ where: { clientId } }),
      this.prisma.aiStrategyRequest.count({ where: { clientId } }),
      this.prisma.socialAccount.count({ where: { clientId } }),
      this.prisma.scheduledPost.groupBy({
        by: ['status'],
        where: { contentItem: { clientId } },
        _count: true,
      }),
      this.prisma.approvalFlow.findMany({
        where: { contentItem: { clientId } },
        include: { steps: true },
      }),
    ]);

    const approvedFlows = approvalFlows.filter((f) => f.status === ApprovalFlowStatus.APPROVED);
    const resolutionHours = approvedFlows
      .map((f) => {
        const lastDecision = f.steps
          .map((s) => s.decidedAt)
          .filter((d): d is Date => !!d)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        if (!lastDecision) return null;
        return (lastDecision.getTime() - f.createdAt.getTime()) / (1000 * 60 * 60);
      })
      .filter((h): h is number => h !== null && h >= 0);

    const avgApprovalHours =
      resolutionHours.length > 0
        ? Math.round((resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length) * 10) / 10
        : null;

    return {
      content: { byStatus: toCountMap(contentByStatus) },
      campaigns: { byStatus: toCountMap(campaignsByStatus) },
      ads: {
        byStatus: toCountMap(adsByStatus),
        totalBudget: adsBudget._sum.budgetAmount ?? 0,
      },
      scheduledPosts: { byStatus: toCountMap(scheduledPostsByStatus) },
      approvals: {
        total: approvalFlows.length,
        pending: approvalFlows.filter((f) =>
          (
            [
              ApprovalFlowStatus.SUBMITTED,
              ApprovalFlowStatus.IN_REVIEW,
              ApprovalFlowStatus.RE_SUBMITTED,
            ] as ApprovalFlowStatus[]
          ).includes(f.status),
        ).length,
        approved: approvedFlows.length,
        rejected: approvalFlows.filter((f) => f.status === ApprovalFlowStatus.REJECTED).length,
        avgResolutionHours: avgApprovalHours,
      },
      aiUsage: {
        conversations: aiConversations,
        captionsSaved: aiCaptions,
        videoProjects: aiVideoProjects,
        strategyRequests: aiStrategyRequests,
      },
      socialAccounts: { total: socialAccounts },
    };
  }
}

function toCountMap(rows: { status: string; _count: number }[]): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [r.status, r._count]));
}
