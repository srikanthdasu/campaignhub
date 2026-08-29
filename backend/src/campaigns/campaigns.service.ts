import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';
import { CampaignStatus } from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';

const INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
  _count: { select: { contentItems: true, adCampaigns: true } },
} as const;

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(clientId: string, actorId: string, dto: CreateCampaignDto) {
    const campaign = await this.prisma.campaign.create({
      data: {
        clientId,
        name: dto.name,
        objective: dto.objective,
        goal: dto.goal,
        kpi: dto.kpi,
        target: dto.target,
        platforms: dto.platforms ?? [],
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        createdById: actorId,
      },
      include: INCLUDE,
    });

    await this.audit.log({
      userId: actorId,
      action: 'CAMPAIGN_CREATED',
      entityType: 'campaign',
      entityId: campaign.id,
    });

    return campaign;
  }

  list(clientId: string) {
    return this.prisma.campaign.findMany({
      where: { clientId },
      include: INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOne(clientId: string, id: string) {
    const campaign = await this.requireInClient(id, clientId);
    return this.prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: {
        ...INCLUDE,
        contentItems: {
          select: { id: true, type: true, status: true, platforms: true, body: true },
          orderBy: { createdAt: 'desc' },
        },
        adCampaigns: {
          select: { id: true, name: true, platform: true, status: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async update(clientId: string, id: string, actorId: string, dto: UpdateCampaignDto) {
    await this.requireInClient(id, clientId);

    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name,
        objective: dto.objective,
        goal: dto.goal,
        kpi: dto.kpi,
        target: dto.target,
        platforms: dto.platforms,
        contentIdeas: dto.contentIdeas as unknown as Prisma.InputJsonValue | undefined,
        assignedToId: dto.assignedToId,
        reviewerId: dto.reviewerId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status,
      },
      include: INCLUDE,
    });

    await this.audit.log({
      userId: actorId,
      action: 'CAMPAIGN_UPDATED',
      entityType: 'campaign',
      entityId: id,
    });

    return campaign;
  }

  async remove(clientId: string, id: string, actorId: string) {
    const campaign = await this.requireInClient(id, clientId);
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Only draft campaigns can be deleted');
    }

    await this.prisma.campaign.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'CAMPAIGN_DELETED',
      entityType: 'campaign',
      entityId: id,
    });
  }

  private async requireInClient(id: string, clientId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.clientId !== clientId) {
      throw new NotFoundException('Campaign not found for this client');
    }
    return campaign;
  }
}
