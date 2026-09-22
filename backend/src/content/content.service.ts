import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MediaService } from '../media/media.service.js';
import { BlobStorageService } from '../media/blob-storage.service.js';
import { ApprovalsService } from '../approvals/approvals.service.js';
import { CampaignsService } from '../campaigns/campaigns.service.js';
import { requireInClient } from '../common/require-in-client.js';
import { CreateContentDto } from './dto/create-content.dto.js';
import { UpdateContentDto } from './dto/update-content.dto.js';
import { SubmitContentDto } from './dto/submit-content.dto.js';
import { ContentStatus, Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const EDITABLE_STATUSES: ContentStatus[] = [ContentStatus.DRAFT, ContentStatus.CHANGES_REQUESTED];
const AGENCY_WIDE_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SUPER_ADMIN];

@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private media: MediaService,
    private approvals: ApprovalsService,
    private campaigns: CampaignsService,
    private blobStorage: BlobStorageService,
  ) {}

  async create(clientId: string, user: AuthenticatedUser, dto: CreateContentDto) {
    if (dto.mediaAssetId) await this.media.requireInClient(dto.mediaAssetId, clientId);
    if (dto.campaignId) await this.campaigns.requireInClient(dto.campaignId, clientId);

    const item = await this.prisma.contentItem.create({
      data: {
        clientId,
        campaignId: dto.campaignId,
        type: dto.type,
        body: dto.body,
        platforms: dto.platforms ?? [],
        mediaAssetId: dto.mediaAssetId,
        aiGenerated: dto.aiGenerated ?? false,
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

  async list(clientId: string, status?: ContentStatus, campaignId?: string) {
    const items = await this.prisma.contentItem.findMany({
      where: { clientId, status, campaignId },
      orderBy: { createdAt: 'desc' },
      include: { mediaAsset: true, approvalFlow: { include: { steps: true } } },
    });
    return Promise.all(items.map((item) => this.signMediaAsset(item)));
  }

  async getOne(clientId: string, id: string) {
    const item = await this.requireInClient(id, clientId);
    const found = await this.prisma.contentItem.findUnique({
      where: { id: item.id },
      include: { mediaAsset: true, approvalFlow: { include: { steps: true } } },
    });
    return found && this.signMediaAsset(found);
  }

  // contentItem.mediaAsset carries the same bare, unauthenticated storageUrl MediaService.list
  // would otherwise leak (see BlobStorageService.getReadUrl) — this `include` bypasses
  // MediaService entirely, so it needs its own signing step here.
  private async signMediaAsset<T extends { mediaAsset: { storageUrl: string } | null }>(
    item: T,
  ): Promise<T> {
    if (!item.mediaAsset) return item;
    return { ...item, mediaAsset: { ...item.mediaAsset, storageUrl: await this.blobStorage.getReadUrl(item.mediaAsset.storageUrl) } };
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
      await this.media.requireInClient(dto.mediaAssetId, clientId);
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

    await this.assertApproversValid(dto.approverIds, user);

    return this.approvals.createFlowForContent(id, user.sub, dto.approverIds, dto.mode, dto.dueDate);
  }

  // Runs for every submitter, not just clients — approverIds used to go straight into the
  // approval flow unvalidated for agency staff, meaning a cross-agency user id would silently
  // succeed and then show up (with full client details) in that other agency's approvals list.
  // A client can never name themselves — or another client — as the approver of their own
  // content: the agency is the point of contact if something wrong goes out. Staff submitters,
  // however, legitimately need to name a client-role approver (the normal "we submit, client
  // approves" workflow), so that restriction only applies when the submitter is themselves a
  // client. Mirrors the equally-real rule in ApprovalsService.decide() that nobody can approve
  // content they created.
  private async assertApproversValid(approverIds: string[], user: AuthenticatedUser) {
    if (approverIds.includes(user.sub)) {
      throw new ForbiddenException('You cannot name yourself as the approver of your own content');
    }
    const approvers = await this.prisma.user.findMany({
      where: { id: { in: approverIds }, agencyId: user.agencyId! },
      select: { id: true, role: true },
    });
    if (approvers.length !== approverIds.length) {
      throw new ForbiddenException('Approvers must belong to your agency');
    }
    if (user.role === Role.CLIENT && approvers.some((a) => a.role === Role.CLIENT)) {
      throw new ForbiddenException('Approvers must be agency staff, not client-portal users');
    }
  }

  private assertCanEdit(item: { createdById: string | null }, user: AuthenticatedUser) {
    const isOwnerOfItem = item.createdById === user.sub;
    if (!isOwnerOfItem && !AGENCY_WIDE_ROLES.includes(user.role)) {
      throw new ForbiddenException('You can only edit content you created');
    }
  }

  private async requireInClient(id: string, clientId: string) {
    return requireInClient(() => this.prisma.contentItem.findUnique({ where: { id } }), clientId, 'Content item');
  }
}
