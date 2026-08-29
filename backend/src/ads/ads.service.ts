import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateAdDto } from './dto/create-ad.dto.js';
import { UpdateAdDto } from './dto/update-ad.dto.js';
import { ReviewAdDto } from './dto/review-ad.dto.js';
import { AdStatus } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const EDITABLE_STATUSES: AdStatus[] = [AdStatus.DRAFT, AdStatus.REJECTED];

@Injectable()
export class AdsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(clientId: string, actorId: string, dto: CreateAdDto) {
    const ad = await this.prisma.adCampaign.create({
      data: {
        clientId,
        campaignId: dto.campaignId,
        name: dto.name,
        objective: dto.objective,
        platform: dto.platform,
        createdById: actorId,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'AD_CAMPAIGN_CREATED',
      entityType: 'ad_campaign',
      entityId: ad.id,
    });

    return ad;
  }

  list(clientId: string) {
    return this.prisma.adCampaign.findMany({
      where: { clientId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOne(clientId: string, id: string) {
    return this.requireInClient(id, clientId);
  }

  async update(clientId: string, id: string, actorId: string, dto: UpdateAdDto) {
    const ad = await this.requireInClient(id, clientId);
    if (!EDITABLE_STATUSES.includes(ad.status)) {
      throw new BadRequestException('This ad can no longer be edited — it is pending review or already launched');
    }

    const updated = await this.prisma.adCampaign.update({
      where: { id },
      data: {
        name: dto.name,
        objective: dto.objective,
        platform: dto.platform,
        audienceNotes: dto.audienceNotes,
        budgetAmount: dto.budgetAmount,
        budgetCurrency: dto.budgetCurrency,
        creativeText: dto.creativeText,
        creativeMediaAssetId: dto.creativeMediaAssetId,
        // Editing a rejected ad restarts the approval gate.
        status: ad.status === AdStatus.REJECTED ? AdStatus.DRAFT : undefined,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'AD_CAMPAIGN_UPDATED',
      entityType: 'ad_campaign',
      entityId: id,
    });

    return updated;
  }

  async submitForApproval(clientId: string, id: string, actorId: string) {
    const ad = await this.requireInClient(id, clientId);
    if (ad.status !== AdStatus.DRAFT) {
      throw new BadRequestException('Only a draft ad can be submitted for approval');
    }
    if (!ad.budgetAmount || !ad.creativeText) {
      throw new BadRequestException('Budget and creative must be set before submitting for approval');
    }

    const updated = await this.prisma.adCampaign.update({
      where: { id },
      data: { status: AdStatus.PENDING_APPROVAL },
    });

    await this.audit.log({
      userId: actorId,
      action: 'AD_CAMPAIGN_SUBMITTED',
      entityType: 'ad_campaign',
      entityId: id,
    });

    return updated;
  }

  async review(clientId: string, id: string, user: AuthenticatedUser, dto: ReviewAdDto) {
    const ad = await this.requireInClient(id, clientId);
    if (ad.status !== AdStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only an ad pending approval can be reviewed');
    }

    const updated = await this.prisma.adCampaign.update({
      where: { id },
      data: {
        status: dto.status,
        approvedById: user.sub,
        approvedAt: new Date(),
      },
    });

    await this.audit.log({
      userId: user.sub,
      action: dto.status === AdStatus.APPROVED ? 'AD_CAMPAIGN_APPROVED' : 'AD_CAMPAIGN_REJECTED',
      entityType: 'ad_campaign',
      entityId: id,
      metadata: { note: dto.note },
    });

    return updated;
  }

  async launch(clientId: string, id: string, actorId: string) {
    const ad = await this.requireInClient(id, clientId);
    if (ad.status !== AdStatus.APPROVED) {
      throw new BadRequestException('Only an approved ad can be launched');
    }

    const updated = await this.prisma.adCampaign.update({
      where: { id },
      data: { status: AdStatus.LAUNCHED, launchedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'AD_CAMPAIGN_LAUNCHED',
      entityType: 'ad_campaign',
      entityId: id,
      metadata: { simulated: true },
    });

    return updated;
  }

  async remove(clientId: string, id: string, actorId: string) {
    const ad = await this.requireInClient(id, clientId);
    if (ad.status !== AdStatus.DRAFT) {
      throw new BadRequestException('Only a draft ad can be deleted');
    }

    await this.prisma.adCampaign.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'AD_CAMPAIGN_DELETED',
      entityType: 'ad_campaign',
      entityId: id,
    });
  }

  private async requireInClient(id: string, clientId: string) {
    const ad = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!ad || ad.clientId !== clientId) {
      throw new NotFoundException('Ad campaign not found for this client');
    }
    return ad;
  }
}
