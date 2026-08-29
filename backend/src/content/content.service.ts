import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MediaService } from '../media/media.service.js';
import { ApprovalsService } from '../approvals/approvals.service.js';
import { CreateContentDto } from './dto/create-content.dto.js';
import { UpdateContentDto } from './dto/update-content.dto.js';
import { SubmitContentDto } from './dto/submit-content.dto.js';
import { ContentStatus, Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const EDITABLE_STATUSES: ContentStatus[] = [ContentStatus.DRAFT, ContentStatus.CHANGES_REQUESTED];
const AGENCY_WIDE_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.MANAGER];

@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private media: MediaService,
    private approvals: ApprovalsService,
  ) {}

  async create(clientId: string, user: AuthenticatedUser, dto: CreateContentDto) {
    const item = await this.prisma.contentItem.create({
      data: {
        clientId,
        campaignId: dto.campaignId,
        type: dto.type,
        body: dto.body,
        platforms: dto.platforms ?? [],
        mediaAssetId: dto.mediaAssetId,
        createdById: user.sub,
      },
    });

    if (dto.mediaAssetId) await this.media.incrementUsage(dto.mediaAssetId);

    await this.audit.log({
      userId: user.sub,
      action: 'CONTENT_CREATED',
      entityType: 'content_item',
      entityId: item.id,
    });

    return item;
  }

  async list(clientId: string, status?: ContentStatus) {
    return this.prisma.contentItem.findMany({
      where: { clientId, status },
      orderBy: { createdAt: 'desc' },
      include: { mediaAsset: true, approvalFlow: { include: { steps: true } } },
    });
  }

  async getOne(clientId: string, id: string) {
    const item = await this.requireInClient(id, clientId);
    return this.prisma.contentItem.findUnique({
      where: { id: item.id },
      include: { mediaAsset: true, approvalFlow: { include: { steps: true } } },
    });
  }

  async update(clientId: string, id: string, user: AuthenticatedUser, dto: UpdateContentDto) {
    const item = await this.requireInClient(id, clientId);
    this.assertCanEdit(item, user);
    if (!EDITABLE_STATUSES.includes(item.status)) {
      throw new BadRequestException(
        'Content can only be edited while in draft or changes-requested state',
      );
    }

    if (dto.mediaAssetId && dto.mediaAssetId !== item.mediaAssetId) {
      await this.media.incrementUsage(dto.mediaAssetId);
    }

    const updated = await this.prisma.contentItem.update({
      where: { id },
      data: { body: dto.body, platforms: dto.platforms, mediaAssetId: dto.mediaAssetId },
    });

    await this.audit.log({
      userId: user.sub,
      action: 'CONTENT_UPDATED',
      entityType: 'content_item',
      entityId: id,
    });

    return updated;
  }

  async remove(clientId: string, id: string, user: AuthenticatedUser) {
    const item = await this.requireInClient(id, clientId);
    this.assertCanEdit(item, user);
    if (item.status !== ContentStatus.DRAFT) {
      throw new BadRequestException('Only draft content can be deleted');
    }

    await this.prisma.contentItem.delete({ where: { id } });
    await this.audit.log({
      userId: user.sub,
      action: 'CONTENT_DELETED',
      entityType: 'content_item',
      entityId: id,
    });
  }

  async submit(clientId: string, id: string, user: AuthenticatedUser, dto: SubmitContentDto) {
    const item = await this.requireInClient(id, clientId);
    this.assertCanEdit(item, user);

    if (item.status === ContentStatus.CHANGES_REQUESTED) {
      return this.approvals.resubmit(id, user.sub);
    }
    if (item.status !== ContentStatus.DRAFT) {
      throw new BadRequestException('Only draft or changes-requested content can be submitted');
    }

    return this.approvals.createFlowForContent(id, user.sub, dto.approverIds, dto.mode, dto.dueDate);
  }

  private assertCanEdit(item: { createdById: string | null }, user: AuthenticatedUser) {
    const isOwnerOfItem = item.createdById === user.sub;
    if (!isOwnerOfItem && !AGENCY_WIDE_ROLES.includes(user.role)) {
      throw new ForbiddenException('You can only edit content you created');
    }
  }

  private async requireInClient(id: string, clientId: string) {
    const item = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!item || item.clientId !== clientId) {
      throw new NotFoundException('Content item not found for this client');
    }
    return item;
  }
}
