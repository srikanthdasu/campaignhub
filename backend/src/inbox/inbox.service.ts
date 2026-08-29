import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SimulateMessageDto } from './dto/simulate-message.dto.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Injectable()
export class InboxService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async simulate(clientId: string, actorId: string, dto: SimulateMessageDto) {
    const message = await this.prisma.inboxMessage.create({
      data: {
        clientId,
        platform: dto.platform,
        senderName: dto.senderName,
        message: dto.message,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'INBOX_MESSAGE_SIMULATED',
      entityType: 'inbox_message',
      entityId: message.id,
    });

    return message;
  }

  async list(clientId: string, unreadOnly?: boolean) {
    return this.prisma.inboxMessage.findMany({
      where: { clientId, isRead: unreadOnly ? false : undefined },
      orderBy: { receivedAt: 'desc' },
    });
  }

  async markRead(clientId: string, id: string) {
    await this.requireInClient(id, clientId);
    return this.prisma.inboxMessage.update({ where: { id }, data: { isRead: true } });
  }

  /**
   * Records that a reply was sent — doesn't actually deliver it to the platform, since that
   * needs the real OAuth connection from Social Accounts & Integrations. Marks the message
   * read and logs the reply text to the audit trail so there's a record once real delivery
   * lands.
   */
  async reply(clientId: string, id: string, user: AuthenticatedUser, reply: string) {
    const message = await this.requireInClient(id, clientId);

    await this.prisma.inboxMessage.update({ where: { id }, data: { isRead: true } });
    await this.audit.log({
      userId: user.sub,
      action: 'INBOX_MESSAGE_REPLIED',
      entityType: 'inbox_message',
      entityId: id,
      metadata: { reply, deliveredToPlatform: false },
    });

    return message;
  }

  private async requireInClient(id: string, clientId: string) {
    const message = await this.prisma.inboxMessage.findUnique({ where: { id } });
    if (!message || message.clientId !== clientId) {
      throw new NotFoundException('Inbox message not found for this client');
    }
    return message;
  }
}
