import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UpsertBrandKitDto } from './dto/upsert-brand-kit.dto.js';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class BrandKitService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async get(clientId: string) {
    const kit = await this.prisma.brandKit.findUnique({ where: { clientId } });
    if (!kit) {
      // No kit yet is a normal state for a freshly created client — return an empty shell
      // rather than 404, so the frontend can render the form directly.
      return null;
    }
    return kit;
  }

  async upsert(clientId: string, actorId: string, dto: UpsertBrandKitDto) {
    const data = {
      logoUrl: dto.logoUrl,
      primaryColor: dto.primaryColor,
      secondaryColor: dto.secondaryColor,
      fonts: dto.fonts as Prisma.InputJsonValue | undefined,
      voiceGuidelines: dto.voiceGuidelines,
      brandRules: dto.brandRules as Prisma.InputJsonValue | undefined,
      aiContext: dto.aiContext,
    };

    const kit = await this.prisma.brandKit.upsert({
      where: { clientId },
      create: { clientId, ...data },
      update: data,
    });

    await this.audit.log({
      userId: actorId,
      action: 'BRAND_KIT_UPDATED',
      entityType: 'client',
      entityId: clientId,
    });

    return kit;
  }
}
