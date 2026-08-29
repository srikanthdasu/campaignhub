import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

export interface LogAuditEntryParams {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: LogAuditEntryParams) {
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata,
      },
    });
  }

  async listForAgency(agencyId: string, take = 100) {
    return this.prisma.auditLog.findMany({
      where: { user: { agencyId } },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }
}
