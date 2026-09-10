import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ContentStatus, ScheduledPostStatus } from '../generated/prisma/client.js';

/**
 * Agency-wide rollup for the dashboard — same "real counts only, no fabricated reach/engagement"
 * rule as AnalyticsService's per-client overview, just aggregated across every client instead of
 * one. No social platform reports real metrics back to us yet, so there is nothing honest to show
 * for reach, engagement, or performance numbers here.
 */
@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async getOverview(agencyId: string) {
    const [
      totalClients,
      connectedAccounts,
      contentByStatus,
      scheduledPostsByStatus,
      scheduledPostsByPlatform,
      upcoming,
      recentActivity,
    ] = await Promise.all([
      this.prisma.client.count({ where: { agencyId, deletedAt: null } }),
      this.prisma.socialAccount.count({ where: { client: { agencyId } } }),
      this.prisma.contentItem.groupBy({
        by: ['status'],
        where: { client: { agencyId } },
        _count: true,
      }),
      this.prisma.scheduledPost.groupBy({
        by: ['status'],
        where: { contentItem: { client: { agencyId } } },
        _count: true,
      }),
      this.prisma.scheduledPost.groupBy({
        by: ['platform'],
        where: { contentItem: { client: { agencyId } } },
        _count: true,
      }),
      this.prisma.scheduledPost.findMany({
        where: { contentItem: { client: { agencyId } }, status: ScheduledPostStatus.PENDING },
        orderBy: { scheduledTime: 'asc' },
        take: 5,
        select: {
          id: true,
          platform: true,
          scheduledTime: true,
          contentItem: { select: { type: true, body: true, client: { select: { name: true } } } },
        },
      }),
      this.audit.listForAgency(agencyId, 8),
    ]);

    const contentCounts = toCountMap(contentByStatus);
    const scheduledCounts = toCountMap(scheduledPostsByStatus);

    return {
      totalClients,
      connectedAccounts,
      // Mirrors Content Planner's grouping: CHANGES_REQUESTED counts as a draft still being
      // worked on, not as "pending approval" (that's specifically awaiting a reviewer).
      posts: {
        drafts: (contentCounts[ContentStatus.DRAFT] ?? 0) + (contentCounts[ContentStatus.CHANGES_REQUESTED] ?? 0),
        pendingApproval: contentCounts[ContentStatus.IN_REVIEW] ?? 0,
        approved: contentCounts[ContentStatus.APPROVED] ?? 0,
        scheduled: scheduledCounts[ScheduledPostStatus.PENDING] ?? 0,
        published: scheduledCounts[ScheduledPostStatus.PUBLISHED] ?? 0,
        failed: scheduledCounts[ScheduledPostStatus.FAILED] ?? 0,
        rejected: contentCounts[ContentStatus.REJECTED] ?? 0,
      },
      postsByPlatform: Object.fromEntries(scheduledPostsByPlatform.map((r) => [r.platform, r._count])),
      upcomingScheduledPosts: upcoming.map((p) => ({
        id: p.id,
        platform: p.platform,
        scheduledTime: p.scheduledTime,
        body: p.contentItem.body,
        type: p.contentItem.type,
        clientName: p.contentItem.client.name,
      })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        createdAt: a.createdAt,
        actorName: a.user?.name ?? null,
      })),
    };
  }
}

function toCountMap(rows: { status: string; _count: number }[]): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [r.status, r._count]));
}
