import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

export interface LogAuditEntryParams {
  userId?: string | null;
  // Only needed for entries with no userId (unattended cron/webhook actions) — when a userId is
  // given, agencyId is looked up from it automatically, so existing call sites need no changes.
  agencyId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: LogAuditEntryParams) {
    let agencyId = params.agencyId ?? null;
    if (!agencyId && params.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { agencyId: true },
      });
      agencyId = user?.agencyId ?? null;
    }

    await this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        agencyId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata,
      },
    });
  }

  async listForAgency(agencyId: string, take = 100) {
    return this.prisma.auditLog.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }
}
