import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BlobStorageService } from '../media/blob-storage.service.js';
import {
  ApprovalDecision,
  ApprovalFlowStatus,
  ApprovalMode,
  ContentStatus,
  Role,
} from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const APPROVAL_STEP_INCLUDE = {
  steps: {
    orderBy: { stepOrder: 'asc' as const },
    include: { approver: { select: { id: true, name: true } } },
  },
  contentItem: {
    include: {
      client: true,
      campaign: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      mediaAsset: { select: { id: true, storageUrl: true, fileName: true } },
    },
  },
};

@Injectable()
export class ApprovalsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private blobStorage: BlobStorageService,
  ) {}

  // APPROVAL_STEP_INCLUDE embeds contentItem.mediaAsset, whose storageUrl is a bare,
  // unauthenticated blob reference (see BlobStorageService.getReadUrl) — every flow returned to
  // the frontend needs it signed, same reasoning as content.service.ts's signMediaAsset.
  private async signFlow<T extends { contentItem: { mediaAsset: { storageUrl: string } | null } }>(
    flow: T,
  ): Promise<T> {
    const mediaAsset = flow.contentItem.mediaAsset;
    if (!mediaAsset) return flow;
    return {
      ...flow,
      contentItem: { ...flow.contentItem, mediaAsset: { ...mediaAsset, storageUrl: await this.blobStorage.getReadUrl(mediaAsset.storageUrl) } },
    };
  }

  private signFlows<T extends { contentItem: { mediaAsset: { storageUrl: string } | null } }>(
    flows: T[],
  ): Promise<T[]> {
    return Promise.all(flows.map((f) => this.signFlow(f)));
  }

  async createFlowForContent(
    contentItemId: string,
    actorId: string,
    approverIds: string[],
    mode: ApprovalMode = ApprovalMode.SEQUENTIAL,
    dueDate?: string,
  ) {
    // The same approver named twice would violate the DB's own @@unique([approvalFlowId,
    // approverId]) — de-duping here turns an accidental double-pick in the submit form into a
    // silent no-op instead of a 500.
    const uniqueApproverIds = [...new Set(approverIds)];

    const flow = await this.prisma.$transaction(async (tx) => {
      const flow = await tx.approvalFlow.create({
        data: {
          contentItemId,
          mode,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          status: ApprovalFlowStatus.IN_REVIEW,
          steps: {
            create: uniqueApproverIds.map((approverId, i) => ({
              approverId,
              stepOrder: mode === ApprovalMode.SEQUENTIAL ? i + 1 : null,
            })),
          },
        },
        include: APPROVAL_STEP_INCLUDE,
      });

      await tx.contentItem.update({
        where: { id: contentItemId },
        data: { status: ContentStatus.IN_REVIEW },
      });

      return flow;
    });

    await this.audit.log({
      userId: actorId,
      action: 'CONTENT_SUBMITTED_FOR_APPROVAL',
      entityType: 'content_item',
      entityId: contentItemId,
      metadata: { mode, approverIds: uniqueApproverIds },
    });

    await this.notifications.createMany(
      uniqueApproverIds,
      'Content is waiting for your review',
      '/approvals',
    );

    return this.signFlow(flow);
  }

  async listForUser(user: AuthenticatedUser) {
    if (user.role === Role.OWNER || user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      const flows = await this.prisma.approvalFlow.findMany({
        where: { contentItem: { client: { agencyId: user.agencyId! } } },
        include: APPROVAL_STEP_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
      return this.signFlows(flows);
    }

    const flows = await this.prisma.approvalFlow.findMany({
      where: {
        steps: { some: { approverId: user.sub } },
        contentItem: { client: { agencyId: user.agencyId! } },
      },
      include: APPROVAL_STEP_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return this.signFlows(flows);
  }

  /** Controller-facing read: enforces the requester can actually see this flow. */
  async getById(id: string, user: AuthenticatedUser) {
    const flow = await this.fetchFlow(id);

    if (flow.contentItem.client.agencyId !== user.agencyId) {
      throw new NotFoundException('Approval flow not found');
    }
    const isAgencyWide =
      user.role === Role.OWNER ||
      user.role === Role.ADMIN ||
      user.role === Role.MANAGER ||
      user.role === Role.SUPER_ADMIN;
    const isAssignedApprover = flow.steps.some((s) => s.approverId === user.sub);
    if (!isAgencyWide && !isAssignedApprover) {
      throw new ForbiddenException('You do not have access to this approval flow');
    }

    return this.signFlow(flow);
  }

  private async fetchFlow(id: string) {
    const flow = await this.prisma.approvalFlow.findUnique({
      where: { id },
      include: APPROVAL_STEP_INCLUDE,
    });
    if (!flow) throw new NotFoundException('Approval flow not found');
    return flow;
  }

  async decide(
    flowId: string,
    stepId: string,
    user: AuthenticatedUser,
    decision: ApprovalDecision,
    comment?: string,
  ) {
    if (decision === ApprovalDecision.PENDING) {
      throw new BadRequestException('A decision must be APPROVED, CHANGES_REQUESTED, or REJECTED');
    }

    const flow = await this.fetchFlow(flowId);

    if (flow.contentItem.client.agencyId !== user.agencyId) {
      throw new NotFoundException('Approval flow not found');
    }

    // Nobody decides their own content, regardless of role — this is what actually makes
    // "client creates, agency approves" (or the reverse) a real rule rather than a UI convention.
    if (flow.contentItem.createdById === user.sub) {
      throw new ForbiddenException('You cannot approve content you created yourself');
    }

    const step = flow.steps.find((s) => s.id === stepId);
    if (!step) throw new NotFoundException('Approval step not found on this flow');

    const isOverride = user.role === Role.OWNER || user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
    if (!isOverride && step.approverId !== user.sub) {
      throw new ForbiddenException('You are not the assigned approver for this step');
    }
    if (step.decision !== ApprovalDecision.PENDING) {
      throw new BadRequestException('This step has already been decided');
    }
    if (flow.mode === ApprovalMode.SEQUENTIAL) {
      const nextPending = flow.steps
        .filter((s) => s.decision === ApprovalDecision.PENDING)
        .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))[0];
      if (nextPending?.id !== stepId) {
        throw new BadRequestException('Steps must be decided in order for a sequential flow');
      }
    }

    await this.prisma.approvalStep.update({
      where: { id: stepId },
      data: { decision, comment, decidedAt: new Date() },
    });

    await this.audit.log({
      userId: user.sub,
      action: `APPROVAL_STEP_${decision}`,
      entityType: 'approval_flow',
      entityId: flowId,
      metadata: { stepId, comment },
    });

    const resolved = await this.resolveFlowStatus(flowId);

    const createdById = resolved.contentItem.createdById;
    if (createdById && createdById !== user.sub) {
      await this.notifications.create(
        createdById,
        `Your content was ${decision.toLowerCase().replace('_', ' ')}`,
        '/content-planner',
      );
    }

    return resolved;
  }

  async resubmit(contentItemId: string, actorId: string) {
    const flow = await this.prisma.approvalFlow.findUnique({ where: { contentItemId } });
    if (!flow) throw new NotFoundException('No approval flow exists for this content item');

    await this.prisma.$transaction([
      this.prisma.approvalStep.updateMany({
        where: { approvalFlowId: flow.id },
        data: { decision: ApprovalDecision.PENDING, comment: null, decidedAt: null },
      }),
      this.prisma.approvalFlow.update({
        where: { id: flow.id },
        data: { status: ApprovalFlowStatus.RE_SUBMITTED },
      }),
      this.prisma.contentItem.update({
        where: { id: contentItemId },
        data: { status: ContentStatus.IN_REVIEW },
      }),
    ]);

    await this.audit.log({
      userId: actorId,
      action: 'CONTENT_RESUBMITTED_FOR_APPROVAL',
      entityType: 'content_item',
      entityId: contentItemId,
    });

    const updated = await this.prisma.approvalFlow.update({
      where: { id: flow.id },
      data: { status: ApprovalFlowStatus.IN_REVIEW },
      include: APPROVAL_STEP_INCLUDE,
    });
    return this.signFlow(updated);
  }

  /** Recomputes flow + content status from the current step decisions. */
  private async resolveFlowStatus(flowId: string) {
    const flow = await this.fetchFlow(flowId);

    let flowStatus: ApprovalFlowStatus = flow.status;
    let contentStatus: ContentStatus | null = null;

    if (flow.steps.some((s) => s.decision === ApprovalDecision.REJECTED)) {
      flowStatus = ApprovalFlowStatus.REJECTED;
      contentStatus = ContentStatus.REJECTED;
    } else if (flow.steps.some((s) => s.decision === ApprovalDecision.CHANGES_REQUESTED)) {
      flowStatus = ApprovalFlowStatus.CHANGES_REQUESTED;
      contentStatus = ContentStatus.CHANGES_REQUESTED;
    } else if (flow.steps.every((s) => s.decision === ApprovalDecision.APPROVED)) {
      flowStatus = ApprovalFlowStatus.APPROVED;
      contentStatus = ContentStatus.APPROVED;
    } else {
      flowStatus = ApprovalFlowStatus.IN_REVIEW;
    }

    await this.prisma.approvalFlow.update({ where: { id: flowId }, data: { status: flowStatus } });
    if (contentStatus) {
      await this.prisma.contentItem.update({
        where: { id: flow.contentItemId },
        data: { status: contentStatus },
      });
    }

    const finalFlow = await this.fetchFlow(flowId);
    return this.signFlow(finalFlow);
  }
}
