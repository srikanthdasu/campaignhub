import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from './email.service.js';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  /** Called by other services when a real event happens — not a user-facing endpoint. */
  async create(userId: string, message: string, link?: string) {
    const notification = await this.prisma.notification.create({ data: { userId, message, link } });
    await this.emailOne(userId, message);
    return notification;
  }

  async createMany(userIds: string[], message: string, link?: string) {
    if (userIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, message, link })),
    });
    await Promise.all(userIds.map((userId) => this.emailOne(userId, message)));
  }

  // Best-effort — a failed/unconfigured email must never take down the in-app notification it
  // rides alongside, so this never throws (EmailService itself already swallows send errors).
  private async emailOne(userId: string, message: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user) await this.email.send(user.email, 'CampaignHub AI notification', message);
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
