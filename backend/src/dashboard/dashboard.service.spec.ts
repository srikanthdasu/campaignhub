import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

function buildService() {
  const prisma = {
    client: { count: vi.fn(() => Promise.resolve(3)) },
    socialAccount: { count: vi.fn(() => Promise.resolve(5)) },
    contentItem: {
      groupBy: vi.fn(() =>
        Promise.resolve([
          { status: 'DRAFT', _count: 2 },
          { status: 'IN_REVIEW', _count: 1 },
          { status: 'APPROVED', _count: 4 },
        ]),
      ),
    },
    scheduledPost: {
      groupBy: vi.fn((args: { by: string[] }) =>
        args.by[0] === 'status'
          ? Promise.resolve([
              { status: 'PENDING', _count: 6 },
              { status: 'PUBLISHED', _count: 9 },
            ])
          : Promise.resolve([{ platform: 'INSTAGRAM', _count: 7 }]),
      ),
      findMany: vi.fn(() =>
        Promise.resolve([
          {
            id: 'sp-1',
            platform: 'INSTAGRAM',
            scheduledTime: new Date('2026-09-15T10:30:00Z'),
            contentItem: { type: 'CAPTION', body: 'Hello', client: { name: 'Acme' } },
          },
        ]),
      ),
    },
  };
  const audit = {
    listForAgency: vi.fn(() =>
      Promise.resolve([
        { id: 'a-1', action: 'CLIENT_CREATED', entityType: 'client', createdAt: new Date(), user: { name: 'Sri' } },
      ]),
    ),
  };
  const service = new DashboardService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, audit };
}

describe('DashboardService.getOverview', () => {
  it('aggregates real counts scoped to the agency', async () => {
    const { service, prisma } = buildService();
    const result = await service.getOverview('agency-1');

    expect(prisma.client.count).toHaveBeenCalledWith({ where: { agencyId: 'agency-1', deletedAt: null } });
    expect(result.totalClients).toBe(3);
    expect(result.connectedAccounts).toBe(5);
    expect(result.posts).toEqual({
      drafts: 2,
      pendingApproval: 1,
      approved: 4,
      scheduled: 6,
      published: 9,
      failed: 0,
      rejected: 0,
    });
    expect(result.postsByPlatform).toEqual({ INSTAGRAM: 7 });
    expect(result.upcomingScheduledPosts).toEqual([
      {
        id: 'sp-1',
        platform: 'INSTAGRAM',
        scheduledTime: new Date('2026-09-15T10:30:00Z'),
        body: 'Hello',
        type: 'CAPTION',
        clientName: 'Acme',
      },
    ]);
    expect(result.recentActivity).toEqual([
      { id: 'a-1', action: 'CLIENT_CREATED', entityType: 'client', createdAt: expect.any(Date), actorName: 'Sri' },
    ]);
  });
});
