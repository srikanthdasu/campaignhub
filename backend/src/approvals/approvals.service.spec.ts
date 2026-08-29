import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalsService } from './approvals.service.js';
import { ApprovalDecision, ApprovalFlowStatus, ApprovalMode, ContentStatus, Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { sub: 'user-1', email: 'a@b.com', role: Role.CREATOR, agencyId: 'agency-1', ...overrides };
}

function buildFlow() {
  return {
    id: 'flow-1',
    contentItemId: 'content-1',
    mode: ApprovalMode.SEQUENTIAL,
    status: ApprovalFlowStatus.IN_REVIEW,
    createdAt: new Date(),
    dueDate: null,
    steps: [
      {
        id: 'step-1',
        approvalFlowId: 'flow-1',
        approverId: 'approver-1',
        stepOrder: 1,
        decision: ApprovalDecision.PENDING,
        comment: null,
        decidedAt: null,
      },
      {
        id: 'step-2',
        approvalFlowId: 'flow-1',
        approverId: 'approver-2',
        stepOrder: 2,
        decision: ApprovalDecision.PENDING,
        comment: null,
        decidedAt: null,
      },
    ],
    contentItem: {
      id: 'content-1',
      clientId: 'client-1',
      createdById: 'creator-1',
      client: { agencyId: 'agency-1' },
    },
  };
}

describe('ApprovalsService.decide', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
  let service: ApprovalsService;
  let flowState: ReturnType<typeof buildFlow>;

  beforeEach(() => {
    flowState = buildFlow();
    prisma = {
      approvalFlow: {
        findUnique: vi.fn(() => Promise.resolve(flowState)),
        update: vi.fn((args: any) => {
          flowState = { ...flowState, ...args.data };
          return Promise.resolve(flowState);
        }),
      },
      approvalStep: {
        update: vi.fn((args: any) => {
          const step = flowState.steps.find((s) => s.id === args.where.id)!;
          Object.assign(step, args.data);
          return Promise.resolve(step);
        }),
      },
      contentItem: { update: vi.fn(() => Promise.resolve({})) },
    };
    audit = { log: vi.fn() };
    notifications = { create: vi.fn(), createMany: vi.fn() };
    service = new ApprovalsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      notifications as unknown as NotificationsService,
    );
  });

  it('rejects deciding a step out of order in sequential mode', async () => {
    const user = makeUser({ sub: 'approver-2' });
    await expect(service.decide('flow-1', 'step-2', user, ApprovalDecision.APPROVED)).rejects.toThrow(
      'Steps must be decided in order',
    );
  });

  it('allows the correct next approver to decide', async () => {
    const user = makeUser({ sub: 'approver-1' });
    await service.decide('flow-1', 'step-1', user, ApprovalDecision.APPROVED);
    expect(flowState.steps[0].decision).toBe(ApprovalDecision.APPROVED);
  });

  it('forbids a non-approver, non-override user from deciding', async () => {
    const user = makeUser({ sub: 'random-user' });
    await expect(service.decide('flow-1', 'step-1', user, ApprovalDecision.APPROVED)).rejects.toThrow(
      'You are not the assigned approver',
    );
  });

  it('allows an OWNER to override and decide any step', async () => {
    const user = makeUser({ sub: 'owner-1', role: Role.OWNER });
    await service.decide('flow-1', 'step-1', user, ApprovalDecision.APPROVED);
    expect(flowState.steps[0].decision).toBe(ApprovalDecision.APPROVED);
  });

  it('marks the flow and content REJECTED when any step is rejected', async () => {
    const user = makeUser({ sub: 'approver-1' });
    await service.decide('flow-1', 'step-1', user, ApprovalDecision.REJECTED);
    expect(flowState.status).toBe(ApprovalFlowStatus.REJECTED);
    expect(prisma.contentItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: ContentStatus.REJECTED } }),
    );
  });

  it('only marks the flow APPROVED once every step is approved', async () => {
    await service.decide('flow-1', 'step-1', makeUser({ sub: 'approver-1' }), ApprovalDecision.APPROVED);
    expect(flowState.status).toBe(ApprovalFlowStatus.IN_REVIEW);

    await service.decide('flow-1', 'step-2', makeUser({ sub: 'approver-2' }), ApprovalDecision.APPROVED);
    expect(flowState.status).toBe(ApprovalFlowStatus.APPROVED);
  });

  it('rejects a PENDING decision value', async () => {
    const user = makeUser({ sub: 'approver-1' });
    await expect(service.decide('flow-1', 'step-1', user, ApprovalDecision.PENDING)).rejects.toThrow(
      'A decision must be',
    );
  });

  it('rejects deciding an already-decided step', async () => {
    flowState.steps[0].decision = ApprovalDecision.APPROVED;
    const user = makeUser({ sub: 'approver-1' });
    await expect(service.decide('flow-1', 'step-1', user, ApprovalDecision.REJECTED)).rejects.toThrow(
      'already been decided',
    );
  });

  it('blocks an OWNER/ADMIN from another agency from deciding this flow (cross-tenant IDOR)', async () => {
    const user = makeUser({ sub: 'foreign-owner', role: Role.OWNER, agencyId: 'agency-2' });
    await expect(service.decide('flow-1', 'step-1', user, ApprovalDecision.APPROVED)).rejects.toThrow(
      'Approval flow not found',
    );
    expect(flowState.steps[0].decision).toBe(ApprovalDecision.PENDING);
  });
});
