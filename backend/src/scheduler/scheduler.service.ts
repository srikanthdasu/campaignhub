import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';
import { ContentStatus, Role, ScheduledPostStatus } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const AGENCY_WIDE_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.MANAGER];

@Injectable()
export class SchedulerService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
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
   * No OAuth publishing integration exists yet (Phase 3), so publishing itself is simulated —
   * but which posts get published is now real: `autoPublishDuePosts` below runs on a schedule
   * and publishes whatever is actually due, same as this manual action would, so scheduled
   * content publishes on time even with nobody watching the app.
   */
  async markPublished(id: string, user: AuthenticatedUser) {
    const post = await this.requireAccess(id, user);
    if (post.status !== ScheduledPostStatus.PENDING) {
      throw new BadRequestException('Only pending posts can be marked published');
    }

    const updated = await this.publishPost(post.id, post.contentItemId);

    await this.audit.log({
      userId: user.sub,
      action: 'SCHEDULED_POST_PUBLISHED',
      entityType: 'scheduled_post',
      entityId: id,
    });

    return updated;
  }

  /** Called by SchedulerCronService — no user in the loop, so no access check or actor on the audit entry. */
  async autoPublishDuePosts() {
    const due = await this.prisma.scheduledPost.findMany({
      where: { status: ScheduledPostStatus.PENDING, scheduledTime: { lte: new Date() } },
    });

    for (const post of due) {
      await this.publishPost(post.id, post.contentItemId);
      await this.audit.log({
        action: 'SCHEDULED_POST_PUBLISHED',
        entityType: 'scheduled_post',
        entityId: post.id,
        metadata: { auto: true },
      });
    }

    return due.length;
  }

  private async publishPost(id: string, contentItemId: string) {
    const updated = await this.prisma.scheduledPost.update({
      where: { id },
      data: { status: ScheduledPostStatus.PUBLISHED, publishedAt: new Date() },
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
