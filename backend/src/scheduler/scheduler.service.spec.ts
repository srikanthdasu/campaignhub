import { describe, expect, it, vi } from 'vitest';
import { SchedulerService } from './scheduler.service.js';
import { ContentStatus, ScheduledPostStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

function buildService(overrides: { count?: number } = {}) {
  const audit = { log: vi.fn() };
  const prisma = {
    scheduledPost: {
      findMany: vi.fn(() =>
        Promise.resolve([
          { id: 'post-1', contentItemId: 'content-1' },
          { id: 'post-2', contentItemId: 'content-1' },
        ]),
      ),
      update: vi.fn(() => Promise.resolve({ id: 'post-1', status: ScheduledPostStatus.PUBLISHED })),
      count: vi.fn(() => Promise.resolve(overrides.count ?? 0)),
    },
    contentItem: { update: vi.fn(() => Promise.resolve({})) },
  };
  const service = new SchedulerService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, audit };
}

describe('SchedulerService.autoPublishDuePosts', () => {
  it('publishes only posts whose scheduled time has passed', async () => {
    const { service, prisma, audit } = buildService();

    const count = await service.autoPublishDuePosts();

    expect(count).toBe(2);
    expect(prisma.scheduledPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: ScheduledPostStatus.PENDING }),
      }),
    );
    expect(prisma.scheduledPost.update).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCHEDULED_POST_PUBLISHED', metadata: { auto: true } }),
    );
  });

  it('marks the content item published once every scheduled post for it is published', async () => {
    const { service, prisma } = buildService({ count: 0 });

    await service.autoPublishDuePosts();

    expect(prisma.contentItem.update).toHaveBeenCalledWith({
      where: { id: 'content-1' },
      data: { status: ContentStatus.PUBLISHED },
    });
  });

  it('leaves the content item alone if other scheduled posts are still pending', async () => {
    const { service, prisma } = buildService({ count: 1 });

    await service.autoPublishDuePosts();

    expect(prisma.contentItem.update).not.toHaveBeenCalled();
  });

  it('does nothing when no posts are due', async () => {
    const audit = { log: vi.fn() };
    const prisma = {
      scheduledPost: { findMany: vi.fn(() => Promise.resolve([])), update: vi.fn(), count: vi.fn() },
      contentItem: { update: vi.fn() },
    };
    const service = new SchedulerService(prisma as unknown as PrismaService, audit as unknown as AuditService);

    const count = await service.autoPublishDuePosts();

    expect(count).toBe(0);
    expect(prisma.scheduledPost.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
