import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UpdateAgencyDto } from './dto/update-agency.dto.js';
import { SubscriptionStatus } from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class AgenciesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Every role in the agency (including CLIENT-portal users, via the client portal header) can
  // call this — so it must never include anything sensitive. stripeCustomerId has no legitimate
  // reader on either the frontend or backend; leave it out rather than exposing it agency-wide.
  //
  // plan/subscriptionStatus are derived from the real Subscription row, not Agency's own
  // plan/subscriptionStatus columns — those are frozen at their schema defaults ("SILVER"/
  // "TRIAL") forever since nothing ever writes to them; Subscription (updated by billing.service
  // on every checkout/cancel) is the only place that reflects what an agency actually has.
  async getMine(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true, name: true, settings: true, createdAt: true },
    });
    if (!agency) throw new NotFoundException('Agency not found');
    return this.withRealPlan(agency, agencyId);
  }

  async updateSettings(agencyId: string, actorId: string, dto: UpdateAgencyDto) {
    const agency = await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        name: dto.name,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
      select: { id: true, name: true, settings: true, createdAt: true },
    });

    await this.audit.log({
      userId: actorId,
      action: 'AGENCY_SETTINGS_UPDATED',
      entityType: 'agency',
      entityId: agencyId,
      metadata: dto as unknown as Prisma.InputJsonValue,
    });

    return this.withRealPlan(agency, agencyId);
  }

  private async withRealPlan<T extends { id: string }>(agency: T, agencyId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { agencyId },
      select: { plan: true, status: true },
    });
    return {
      ...agency,
      plan: subscription?.plan ?? null,
      subscriptionStatus: subscription?.status ?? SubscriptionStatus.TRIAL,
    };
  }
}
