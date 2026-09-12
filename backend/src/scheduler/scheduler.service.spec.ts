import { describe, expect, it, vi } from 'vitest';
import { SchedulerService } from './scheduler.service.js';
import { ContentStatus, Role, ScheduledPostStatus, SocialPlatform } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { ConfigService } from '@nestjs/config';
import type { InstagramPublishService } from '../social-accounts/instagram-publish.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

function buildService(overrides: { count?: number } = {}) {
  const audit = { log: vi.fn() };
  const notifications = { create: vi.fn() };
  const prisma = {
    scheduledPost: {
      findMany: vi.fn(() =>
        Promise.resolve([
          { id: 'post-1', contentItemId: 'content-1', platform: SocialPlatform.FACEBOOK },
          { id: 'post-2', contentItemId: 'content-1', platform: SocialPlatform.FACEBOOK },
        ]),
      ),
      findUniqueOrThrow: vi.fn((args: { where: { id: string } }) =>
        Promise.resolve({ id: args.where.id, platform: SocialPlatform.FACEBOOK }),
      ),
      updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      update: vi.fn(() => Promise.resolve({ id: 'post-1', status: ScheduledPostStatus.PUBLISHED, errorMessage: null })),
      count: vi.fn(() => Promise.resolve(overrides.count ?? 0)),
    },
    contentItem: {
      update: vi.fn(() => Promise.resolve({})),
      findUnique: vi.fn(() => Promise.resolve({ createdById: 'creator-1', client: { name: 'Acme' } })),
    },
  };
  const config = { getOrThrow: vi.fn() };
  const instagramPublish = { publishImage: vi.fn() };
  const service = new SchedulerService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    config as unknown as ConfigService,
    instagramPublish as unknown as InstagramPublishService,
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, audit, notifications };
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
      expect.objectContaining({
        action: 'SCHEDULED_POST_PUBLISHED',
        metadata: expect.objectContaining({ auto: true }),
      }),
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

  it('atomically claims a post before publishing it (PENDING -> PUBLISHING)', async () => {
    const { service, prisma } = buildService();

    await service.autoPublishDuePosts();

    expect(prisma.scheduledPost.updateMany).toHaveBeenCalledWith({
      where: { id: 'post-1', status: ScheduledPostStatus.PENDING },
      data: { status: ScheduledPostStatus.PUBLISHING },
    });
  });

  it('skips a post outright if another process already claimed it (lost the race)', async () => {
    const { service, prisma } = buildService();
    prisma.scheduledPost.updateMany = vi.fn(() => Promise.resolve({ count: 0 }));

    await service.autoPublishDuePosts();

    // Never re-reads the row for a decision, never calls the real Instagram API, and never
    // writes a final PUBLISHED/FAILED status — the process that won the claim owns that.
    expect(prisma.scheduledPost.update).not.toHaveBeenCalled();
  });

  it('does nothing when no posts are due', async () => {
    const audit = { log: vi.fn() };
    const notifications = { create: vi.fn() };
    const prisma = {
      scheduledPost: {
        findMany: vi.fn(() => Promise.resolve([])),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      contentItem: { update: vi.fn(), findUnique: vi.fn() },
    };
    const config = { getOrThrow: vi.fn() };
    const instagramPublish = { publishImage: vi.fn() };
    const service = new SchedulerService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      config as unknown as ConfigService,
      instagramPublish as unknown as InstagramPublishService,
      notifications as unknown as NotificationsService,
    );

    const count = await service.autoPublishDuePosts();

    expect(count).toBe(0);
    expect(prisma.scheduledPost.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('notifies the content creator when a post fails to publish', async () => {
    const audit = { log: vi.fn() };
    const notifications = { create: vi.fn() };
    const config = { getOrThrow: vi.fn() };
    // No mediaAsset attached — publishToInstagram rejects immediately with InstagramPublishError,
    // a real failure path that needs no token-crypto/social-account mocking to exercise.
    const prisma = {
      scheduledPost: {
        findMany: vi.fn(() =>
          Promise.resolve([{ id: 'post-1', contentItemId: 'content-1', platform: SocialPlatform.INSTAGRAM }]),
        ),
        findUniqueOrThrow: vi.fn(() => Promise.resolve({ id: 'post-1', platform: SocialPlatform.INSTAGRAM })),
        updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
        update: vi.fn((args: any) => Promise.resolve({ id: 'post-1', ...args.data })),
        count: vi.fn(() => Promise.resolve(1)),
      },
      contentItem: {
        update: vi.fn(),
        findUnique: vi.fn(() => Promise.resolve({ createdById: 'creator-1', client: { name: 'Acme' } })),
        findUniqueOrThrow: vi.fn(() => Promise.resolve({ mediaAsset: null })),
      },
    };
    const instagramPublish = { publishImage: vi.fn() };
    const service = new SchedulerService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      config as unknown as ConfigService,
      instagramPublish as unknown as InstagramPublishService,
      notifications as unknown as NotificationsService,
    );

    await service.autoPublishDuePosts();

    expect(notifications.create).toHaveBeenCalledWith(
      'creator-1',
      expect.stringContaining('Instagram requires an image or video'),
      '/scheduler',
    );
  });
});

function buildRetryService(post: { status: ScheduledPostStatus; retryCount: number }) {
  const audit = { log: vi.fn() };
  const prisma = {
    scheduledPost: {
      findUnique: vi.fn(() =>
        Promise.resolve({
          id: 'post-1',
          contentItemId: 'content-1',
          platform: SocialPlatform.FACEBOOK,
          status: post.status,
          retryCount: post.retryCount,
          contentItem: { client: { agencyId: 'agency-1' } },
        }),
      ),
      findUniqueOrThrow: vi.fn(() => Promise.resolve({ id: 'post-1', platform: SocialPlatform.FACEBOOK })),
      updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      update: vi.fn(() => Promise.resolve({ id: 'post-1', status: ScheduledPostStatus.PUBLISHED, errorMessage: null })),
      count: vi.fn(() => Promise.resolve(0)),
    },
    contentItem: {
      update: vi.fn(() => Promise.resolve({})),
      findUnique: vi.fn(() => Promise.resolve({ createdById: 'creator-1', client: { name: 'Acme' } })),
    },
  };
  const config = { getOrThrow: vi.fn() };
  const instagramPublish = { publishImage: vi.fn() };
  const notifications = { create: vi.fn() };
  const service = new SchedulerService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    config as unknown as ConfigService,
    instagramPublish as unknown as InstagramPublishService,
    notifications as unknown as NotificationsService,
  );
  const user: AuthenticatedUser = { sub: 'user-1', email: 'a@b.com', role: Role.OWNER, agencyId: 'agency-1' };
  return { service, prisma, audit, user, notifications };
}

describe('SchedulerService.retry', () => {
  it('retries a failed post that is under the retry cap', async () => {
    const { service, prisma } = buildRetryService({ status: ScheduledPostStatus.FAILED, retryCount: 0 });

    await service.retry('post-1', {
      sub: 'user-1',
      email: 'a@b.com',
      role: Role.OWNER,
      agencyId: 'agency-1',
    });

    expect(prisma.scheduledPost.updateMany).toHaveBeenCalledWith({
      where: { id: 'post-1', status: ScheduledPostStatus.FAILED },
      data: { status: ScheduledPostStatus.PENDING, retryCount: { increment: 1 }, errorMessage: null },
    });
  });

  it('rejects retrying a post that is not failed', async () => {
    const { service, prisma, user } = buildRetryService({ status: ScheduledPostStatus.PENDING, retryCount: 0 });

    await expect(service.retry('post-1', user)).rejects.toThrow('Only failed posts can be retried');
    expect(prisma.scheduledPost.updateMany).not.toHaveBeenCalled();
  });

  it('rejects retrying once the retry cap is reached', async () => {
    const { service, prisma, user } = buildRetryService({ status: ScheduledPostStatus.FAILED, retryCount: 3 });

    await expect(service.retry('post-1', user)).rejects.toThrow(/already been retried 3 times/);
    expect(prisma.scheduledPost.updateMany).not.toHaveBeenCalled();
  });
});
