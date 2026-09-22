import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
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
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * AUDIT-2: this used to be a plain throwing write, called inline after real business actions
   * had already completed (e.g. billing.service.ts's activateSubscription, right after the
   * subscription upsert and invoice creation) — a DB hiccup or FK violation here would surface as
   * a failed subscription activation on an already-charged card. Audit logging should never be
   * able to undo a real, already-completed action, so a failure here is caught, sent to Sentry
   * (real alerting, not just a log line nobody watches), and swallowed rather than propagated.
   */
  async log(params: LogAuditEntryParams) {
    try {
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
    } catch (err) {
      this.logger.error(`Failed to write audit log entry for action "${params.action}"`, err);
      Sentry.captureException(err, { extra: { action: params.action, entityType: params.entityType } });
    }
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

  /**
   * AUDIT-1: no retention policy existed at all — confirmed by exhaustive grep, the only
   * operations against AuditLog anywhere in the backend were create and findMany. This is the
   * highest-insert-rate table in the schema (a row on every login attempt, including failures),
   * yet the team had already solved exactly this "table grows forever" problem twice
   * (AuthCronService, ClientsCronService) and never applied the same fix here. Called by
   * AuditCronService — no user in the loop, so no actor on this purge's own audit entry.
   */
  async purgeOld(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count;
  }
}
