import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UpdateAgencyDto } from './dto/update-agency.dto.js';
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
  async getMine(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true, name: true, plan: true, subscriptionStatus: true, settings: true, createdAt: true },
    });
    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }

  async updateSettings(agencyId: string, actorId: string, dto: UpdateAgencyDto) {
    const agency = await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        name: dto.name,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'AGENCY_SETTINGS_UPDATED',
      entityType: 'agency',
      entityId: agencyId,
      metadata: dto as unknown as Prisma.InputJsonValue,
    });

    return agency;
  }
}
