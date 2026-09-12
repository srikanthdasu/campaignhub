import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';
import { ContentStatus, Role, ScheduledPostStatus, SocialPlatform } from '../generated/prisma/client.js';
import { decryptToken } from '../social-accounts/token-crypto.js';
import { InstagramPublishService, InstagramPublishError } from '../social-accounts/instagram-publish.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const AGENCY_WIDE_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.MANAGER];

// A transient failure (a momentary rate limit, a network blip) deserves a few real attempts —
// but an endlessly-retryable post masks a genuinely broken one (bad media, revoked token) behind
// what looks like progress. Past this, the fix is to reschedule with a corrected post.
const MAX_RETRIES = 3;

@Injectable()
export class SchedulerService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private config: ConfigService,
    private instagramPublish: InstagramPublishService,
    private notifications: NotificationsService,
  ) {}

  async schedule(clientId: string, contentItemId: string, user: AuthenticatedUser, dto: CreateScheduleDto) {
    const content = await this.prisma.contentItem.findUnique({ where: { id: contentItemId } });
    if (!content || content.clientId !== clientId) {
      throw new NotFoundException('Content item not found for this client');
    }
    if (content.status !== ContentStatus.APPROVED) {
      throw new BadRequestException('Only approved content can be scheduled');
    }

    const platforms = dto.platforms?.length ? dto.platforms : content.platforms;
    if (!platforms.length) {
      throw new BadRequestException('No platforms selected for this content');
    }

    const posts = await this.prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        platforms.map((platform) =>
          tx.scheduledPost.create({
            data: {
              contentItemId,
              platform,
              scheduledTime: new Date(dto.scheduledTime),
            },
          }),
        ),
      );
      await tx.contentItem.update({
        where: { id: contentItemId },
        data: { status: ContentStatus.SCHEDULED },
      });
      return created;
    });

    await this.audit.log({
      userId: user.sub,
      action: 'CONTENT_SCHEDULED',
      entityType: 'content_item',
      entityId: contentItemId,
      metadata: { platforms, scheduledTime: dto.scheduledTime },
    });

    return posts;
  }

  async listForClient(clientId: string, from?: string, to?: string) {
    return this.prisma.scheduledPost.findMany({
      where: {
        contentItem: { clientId },
        scheduledTime: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: { contentItem: true },
      orderBy: { scheduledTime: 'asc' },
    });
  }

  async reschedule(id: string, user: AuthenticatedUser, scheduledTime: string) {
    const post = await this.requireAccess(id, user);
    if (post.status !== ScheduledPostStatus.PENDING) {
      throw new BadRequestException('Only pending posts can be rescheduled');
    }

    const updated = await this.prisma.scheduledPost.update({
      where: { id },
      data: { scheduledTime: new Date(scheduledTime) },
    });

    await this.audit.log({
      userId: user.sub,
      action: 'SCHEDULED_POST_RESCHEDULED',
      entityType: 'scheduled_post',
      entityId: id,
    });

    return updated;
  }

  async cancel(id: string, user: AuthenticatedUser) {
    const post = await this.requireAccess(id, user);
    if (post.status !== ScheduledPostStatus.PENDING) {
      throw new BadRequestException('Only pending posts can be cancelled');
    }

    await this.prisma.scheduledPost.delete({ where: { id } });
    await this.audit.log({
      userId: user.sub,
      action: 'SCHEDULED_POST_CANCELLED',
      entityType: 'scheduled_post',
      entityId: id,
    });
  }

  /**
   * Instagram actually publishes for real now (see publishPost); every other platform still
   * simulates — same scheduling/cron mechanics, just no real API call underneath yet.
   */
  async markPublished(id: string, user: AuthenticatedUser) {
    const post = await this.requireAccess(id, user);
    if (post.status !== ScheduledPostStatus.PENDING) {
      throw new BadRequestException('Only pending posts can be marked published');
    }

    const updated = await this.publishPost(post.id, post.contentItemId);

    await this.audit.log({
      userId: user.sub,
      action: updated.status === ScheduledPostStatus.FAILED ? 'SCHEDULED_POST_FAILED' : 'SCHEDULED_POST_PUBLISHED',
      entityType: 'scheduled_post',
      entityId: id,
      metadata: updated.errorMessage ? { errorMessage: updated.errorMessage } : undefined,
    });

    return updated;
  }

  async retry(id: string, user: AuthenticatedUser) {
    const post = await this.requireAccess(id, user);
    if (post.status !== ScheduledPostStatus.FAILED) {
      throw new BadRequestException('Only failed posts can be retried');
    }
    if (post.retryCount >= MAX_RETRIES) {
      throw new BadRequestException(
        `This post has already been retried ${MAX_RETRIES} times — reschedule it instead.`,
      );
    }

    const claimed = await this.prisma.scheduledPost.updateMany({
      where: { id, status: ScheduledPostStatus.FAILED },
      data: { status: ScheduledPostStatus.PENDING, retryCount: { increment: 1 }, errorMessage: null },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Only failed posts can be retried');
    }

    const updated = await this.publishPost(post.id, post.contentItemId);

    await this.audit.log({
      userId: user.sub,
      action: updated.status === ScheduledPostStatus.FAILED ? 'SCHEDULED_POST_FAILED' : 'SCHEDULED_POST_PUBLISHED',
      entityType: 'scheduled_post',
      entityId: id,
      metadata: { retry: true, errorMessage: updated.errorMessage ?? undefined },
    });

    return updated;
  }

  /** Called by SchedulerCronService — no user in the loop, so no access check or actor on the audit entry. */
  async autoPublishDuePosts() {
    const due = await this.prisma.scheduledPost.findMany({
      where: { status: ScheduledPostStatus.PENDING, scheduledTime: { lte: new Date() } },
    });

    for (const post of due) {
      const result = await this.publishPost(post.id, post.contentItemId);
      await this.audit.log({
        action: result.status === ScheduledPostStatus.FAILED ? 'SCHEDULED_POST_FAILED' : 'SCHEDULED_POST_PUBLISHED',
        entityType: 'scheduled_post',
        entityId: post.id,
        metadata: { auto: true, errorMessage: result.errorMessage ?? undefined },
      });
    }

    return due.length;
  }

  private async publishPost(id: string, contentItemId: string) {
    // Atomically claim the row before doing anything external. Without this, two overlapping
    // cron ticks (or a cron tick racing a manual "Publish Now" click) could both read the same
    // PENDING row and both call the real Instagram API for it — an actual duplicate post, not
    // just a duplicate DB write. The `where: { status: PENDING }` makes this a no-op for every
    // caller except whichever one wins the race.
    const claim = await this.prisma.scheduledPost.updateMany({
      where: { id, status: ScheduledPostStatus.PENDING },
      data: { status: ScheduledPostStatus.PUBLISHING },
    });
    if (claim.count === 0) {
      return this.prisma.scheduledPost.findUniqueOrThrow({ where: { id } });
    }

    const post = await this.prisma.scheduledPost.findUniqueOrThrow({ where: { id } });
    let externalPostId: string | null = null;

    if (post.platform === SocialPlatform.INSTAGRAM) {
      try {
        externalPostId = await this.publishToInstagram(contentItemId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to publish to Instagram';
        const failed = await this.prisma.scheduledPost.update({
          where: { id },
          data: { status: ScheduledPostStatus.FAILED, errorMessage: message },
        });
        await this.notifyCreatorOfFailure(contentItemId, message);
        return failed;
      }
    }

    const updated = await this.prisma.scheduledPost.update({
      where: { id },
      data: {
        status: ScheduledPostStatus.PUBLISHED,
        publishedAt: new Date(),
        errorMessage: null,
        externalPostId: externalPostId ?? undefined,
      },
    });

    const remaining = await this.prisma.scheduledPost.count({
      where: { contentItemId, status: { not: ScheduledPostStatus.PUBLISHED } },
    });
    if (remaining === 0) {
      await this.prisma.contentItem.update({
        where: { id: contentItemId },
        data: { status: ContentStatus.PUBLISHED },
      });
    }

    return updated;
  }

  // The one truly async, unattended failure in this whole pipeline (the cron can hit it with
  // nobody watching) — without this, a failed post was only visible if someone happened to open
  // the Scheduler page and noticed a red badge.
  private async notifyCreatorOfFailure(contentItemId: string, errorMessage: string) {
    const content = await this.prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: { createdById: true, client: { select: { name: true } } },
    });
    if (!content?.createdById) return;
    await this.notifications.create(
      content.createdById,
      `A scheduled post for ${content.client.name} failed to publish: ${errorMessage}`,
      '/scheduler',
    );
  }

  private async publishToInstagram(contentItemId: string): Promise<string> {
    const content = await this.prisma.contentItem.findUniqueOrThrow({
      where: { id: contentItemId },
      include: { mediaAsset: true },
    });

    if (!content.mediaAsset) {
      throw new InstagramPublishError(
        'Instagram requires an image or video — this content has no media attached.',
      );
    }

    // Manually-added placeholder rows (no OAuth token) can coexist with a real connected
    // account for the same client — without this filter, an arbitrary row could win over the
    // one that actually has a usable token.
    const account = await this.prisma.socialAccount.findFirst({
      where: {
        clientId: content.clientId,
        platform: SocialPlatform.INSTAGRAM,
        accessTokenEncrypted: { not: null },
        externalAccountId: { not: null },
      },
      orderBy: { connectedAt: 'desc' },
    });
    if (!account?.accessTokenEncrypted || !account.externalAccountId) {
      throw new InstagramPublishError('No connected Instagram account found for this client.');
    }

    const encryptionKey = this.config.getOrThrow<string>('TOKEN_ENCRYPTION_KEY');
    const accessToken = decryptToken(account.accessTokenEncrypted, encryptionKey);

    return this.instagramPublish.publishImage(
      account.externalAccountId,
      accessToken,
      content.mediaAsset.storageUrl,
      content.body ?? '',
    );
  }

  private async requireAccess(id: string, user: AuthenticatedUser) {
    const post = await this.prisma.scheduledPost.findUnique({
      where: { id },
      include: { contentItem: { include: { client: true } } },
    });
    if (!post) throw new NotFoundException('Scheduled post not found');
    if (post.contentItem.client.agencyId !== user.agencyId) {
      throw new NotFoundException('Scheduled post not found');
    }
    if (!AGENCY_WIDE_ROLES.includes(user.role)) {
      const hasAccess = await this.prisma.userClientAccess.findUnique({
        where: { userId_clientId: { userId: user.sub, clientId: post.contentItem.clientId } },
      });
      if (!hasAccess) throw new ForbiddenException('You do not have access to this client');
    }
    return post;
  }
}
