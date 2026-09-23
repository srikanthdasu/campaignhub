import { describe, expect, it, vi } from 'vitest';
import { SchedulerService } from './scheduler.service.js';
import { ContentStatus, Role, ScheduledPostStatus, SocialPlatform } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { ConfigService } from '@nestjs/config';
import type { InstagramPublishService } from '../social-accounts/instagram-publish.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { BlobStorageService } from '../media/blob-storage.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { encryptToken } from '../social-accounts/token-crypto.js';

function makeBlobStorage() {
  return { getReadUrl: vi.fn((url: string) => Promise.resolve(url)) } as unknown as BlobStorageService;
}

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
    makeBlobStorage(),
  );
  return { service, prisma, audit, notifications };
}

describe('SchedulerService.reapStuckPublishing', () => {
  it('marks rows stuck in PUBLISHING past the threshold as FAILED and notifies the creator', async () => {
    const { service, prisma, notifications } = buildService();
    prisma.scheduledPost.findMany.mockResolvedValueOnce([
      { id: 'stuck-1', contentItemId: 'content-1' },
      { id: 'stuck-2', contentItemId: 'content-1' },
    ] as never);

    const count = await service.reapStuckPublishing();

    expect(count).toBe(2);
    expect(prisma.scheduledPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: ScheduledPostStatus.PUBLISHING }),
      }),
    );
    expect(prisma.scheduledPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['stuck-1', 'stuck-2'] } },
        data: expect.objectContaining({ status: ScheduledPostStatus.FAILED }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when nothing is stuck', async () => {
    const { service, prisma } = buildService();
    prisma.scheduledPost.findMany.mockResolvedValueOnce([] as never);

    const count = await service.reapStuckPublishing();

    expect(count).toBe(0);
    expect(prisma.scheduledPost.updateMany).not.toHaveBeenCalled();
  });
});

describe('SchedulerService.autoPublishDuePosts', () => {
  it('publishes only posts whose scheduled time has passed', async () => {
    const { service, prisma, audit } = buildService();

    const count = await service.autoPublishDuePosts();

    expect(count).toBe(2);
    expect(prisma.scheduledPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ScheduledPostStatus.PENDING,
          contentItem: { client: { deletedAt: null } },
        }),
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

  it('flags a non-Instagram publish as simulated — no real platform call was made (BROKE-1)', async () => {
    const { service, prisma } = buildService();

    await service.autoPublishDuePosts();

    expect(prisma.scheduledPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ simulated: true }) }),
    );
  });

  it('does not flag a real Instagram publish as simulated', async () => {
    const ENCRYPTION_KEY = 'a-real-32-character-encryption-key';
    const audit = { log: vi.fn() };
    const notifications = { create: vi.fn() };
    const prisma = {
      scheduledPost: {
        findMany: vi.fn(() =>
          Promise.resolve([{ id: 'post-1', contentItemId: 'content-1', platform: SocialPlatform.INSTAGRAM }]),
        ),
        findUniqueOrThrow: vi.fn(() =>
          Promise.resolve({ id: 'post-1', contentItemId: 'content-1', platform: SocialPlatform.INSTAGRAM }),
        ),
        updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
        update: vi.fn((args: any) => Promise.resolve({ id: 'post-1', status: ScheduledPostStatus.PUBLISHED, ...args.data })),
        count: vi.fn(() => Promise.resolve(0)),
      },
      contentItem: {
        update: vi.fn(() => Promise.resolve({})),
        findUnique: vi.fn(() => Promise.resolve({ client: { agencyId: 'agency-1' } })),
        findUniqueOrThrow: vi.fn(() =>
          Promise.resolve({
            clientId: 'client-1',
            mediaAsset: { storageUrl: '/uploads/x.png' },
            body: 'caption',
          }),
        ),
      },
      // decryptToken needs a real ciphertext shape (iv.authTag.data, base64) — encrypt one with
      // the same key/helper the service itself uses, rather than hand-rolling a fake token.
      socialAccount: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            accessTokenEncrypted: encryptToken('real-ig-token', ENCRYPTION_KEY),
            externalAccountId: 'ig-123',
          }),
        ),
      },
    };
    const config = { getOrThrow: vi.fn(() => ENCRYPTION_KEY) };
    const instagramPublish = { publishImage: vi.fn(() => Promise.resolve('ig-post-1')) };
    const service = new SchedulerService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      config as unknown as ConfigService,
      instagramPublish as unknown as InstagramPublishService,
      notifications as unknown as NotificationsService,
      makeBlobStorage(),
    );

    await service.autoPublishDuePosts();

    expect(instagramPublish.publishImage).toHaveBeenCalled();
    expect(prisma.scheduledPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ simulated: false }) }),
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
      makeBlobStorage(),
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
      makeBlobStorage(),
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
    makeBlobStorage(),
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

function buildAccessScopedService(hasAccess: boolean) {
  const audit = { log: vi.fn() };
  const userClientAccessFindUnique = vi.fn(() =>
    Promise.resolve(hasAccess ? { userId: 'user-1', clientId: 'client-1' } : null),
  );
  const prisma = {
    scheduledPost: {
      findUnique: vi.fn(() =>
        Promise.resolve({
          id: 'post-1',
          status: ScheduledPostStatus.PENDING,
          contentItemId: 'content-1',
          contentItem: { clientId: 'client-1', client: { agencyId: 'agency-1' } },
        }),
      ),
      delete: vi.fn(() => Promise.resolve({})),
    },
    userClientAccess: { findUnique: userClientAccessFindUnique },
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
    makeBlobStorage(),
  );
  return { service, prisma, audit, userClientAccessFindUnique };
}

describe('SchedulerService.requireAccess (client-access scoping — AUTH-1)', () => {
  it('blocks a MANAGER with no UserClientAccess grant from cancelling a scheduled post', async () => {
    const { service, prisma, userClientAccessFindUnique } = buildAccessScopedService(false);
    const manager: AuthenticatedUser = { sub: 'user-1', email: 'a@b.com', role: Role.MANAGER, agencyId: 'agency-1' };

    await expect(service.cancel('post-1', manager)).rejects.toThrow('You do not have access to this client');
    expect(userClientAccessFindUnique).toHaveBeenCalledWith({
      where: { userId_clientId: { userId: 'user-1', clientId: 'client-1' } },
    });
    expect(prisma.scheduledPost.delete).not.toHaveBeenCalled();
  });

  it('allows a MANAGER with an explicit UserClientAccess grant to cancel', async () => {
    const { service, prisma } = buildAccessScopedService(true);
    const manager: AuthenticatedUser = { sub: 'user-1', email: 'a@b.com', role: Role.MANAGER, agencyId: 'agency-1' };

    await service.cancel('post-1', manager);
    expect(prisma.scheduledPost.delete).toHaveBeenCalledWith({ where: { id: 'post-1' } });
  });

  it('allows an OWNER to cancel with no UserClientAccess lookup at all', async () => {
    const { service, prisma, userClientAccessFindUnique } = buildAccessScopedService(false);
    const owner: AuthenticatedUser = { sub: 'user-1', email: 'a@b.com', role: Role.OWNER, agencyId: 'agency-1' };

    await service.cancel('post-1', owner);
    expect(userClientAccessFindUnique).not.toHaveBeenCalled();
    expect(prisma.scheduledPost.delete).toHaveBeenCalledWith({ where: { id: 'post-1' } });
  });
});
