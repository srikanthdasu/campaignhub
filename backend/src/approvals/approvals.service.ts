import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  ApprovalDecision,
  ApprovalFlowStatus,
  ApprovalMode,
  ContentStatus,
  Role,
} from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const APPROVAL_STEP_INCLUDE = {
  steps: { orderBy: { stepOrder: 'asc' as const } },
  contentItem: { include: { client: true } },
};

@Injectable()
export class ApprovalsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async createFlowForContent(
    contentItemId: string,
    actorId: string,
    approverIds: string[],
    mode: ApprovalMode = ApprovalMode.SEQUENTIAL,
    dueDate?: string,
  ) {
    const flow = await this.prisma.$transaction(async (tx) => {
      const flow = await tx.approvalFlow.create({
        data: {
          contentItemId,
          mode,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          status: ApprovalFlowStatus.IN_REVIEW,
          steps: {
            create: approverIds.map((approverId, i) => ({
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
      metadata: { mode, approverIds },
    });

    await this.notifications.createMany(
      approverIds,
      'Content is waiting for your review',
      '/approvals',
    );

    return flow;
  }

  async listForUser(user: AuthenticatedUser) {
    if (user.role === Role.OWNER || user.role === Role.ADMIN) {
      return this.prisma.approvalFlow.findMany({
        where: { contentItem: { client: { agencyId: user.agencyId! } } },
        include: APPROVAL_STEP_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.approvalFlow.findMany({
      where: { steps: { some: { approverId: user.sub } } },
      include: APPROVAL_STEP_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Controller-facing read: enforces the requester can actually see this flow. */
  async getById(id: string, user: AuthenticatedUser) {
    const flow = await this.fetchFlow(id);

    if (flow.contentItem.client.agencyId !== user.agencyId) {
      throw new NotFoundException('Approval flow not found');
    }
    const isAgencyWide = user.role === Role.OWNER || user.role === Role.ADMIN || user.role === Role.MANAGER;
    const isAssignedApprover = flow.steps.some((s) => s.approverId === user.sub);
    if (!isAgencyWide && !isAssignedApprover) {
      throw new ForbiddenException('You do not have access to this approval flow');
    }

    return flow;
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

    const step = flow.steps.find((s) => s.id === stepId);
    if (!step) throw new NotFoundException('Approval step not found on this flow');

    const isOverride = user.role === Role.OWNER || user.role === Role.ADMIN;
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

    return this.prisma.approvalFlow.update({
      where: { id: flow.id },
      data: { status: ApprovalFlowStatus.IN_REVIEW },
      include: APPROVAL_STEP_INCLUDE,
    });
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

    return this.fetchFlow(flowId);
  }
}
