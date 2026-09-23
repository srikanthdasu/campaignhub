import { describe, expect, it, vi } from 'vitest';
import { AiStrategyService } from './ai-strategy.service.js';
import { AiStrategyStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AzureAiFoundryService } from '../ai-common/azure-ai-foundry.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';

function buildService(overrides: { request?: any; reply?: string } = {}) {
  const request = overrides.request ?? {
    id: 'req-1',
    clientId: 'client-1',
    title: 'Q1 push',
    goal: 'awareness',
    context: null,
    status: AiStrategyStatus.GENERATED,
  };
  const audit = { log: vi.fn() };
  const notifications = { create: vi.fn(), createMany: vi.fn() };
  const prisma = {
    aiStrategyRequest: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'req-1', ...args.data })),
      findUnique: vi.fn(() => Promise.resolve(request)),
      update: vi.fn((args: any) => Promise.resolve({ ...request, ...args.data })),
      delete: vi.fn(() => Promise.resolve({})),
    },
    aiStrategyGeneration: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'gen-1', ...args.data })),
    },
    client: {
      findUnique: vi.fn(() => Promise.resolve({ agencyId: 'agency-1' })),
    },
    user: {
      findMany: vi.fn(() => Promise.resolve([{ id: 'owner-1' }])),
    },
    userClientAccess: {
      findMany: vi.fn((_args: any) => Promise.resolve([] as { userId: string }[])),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const foundry = { chat: vi.fn(() => Promise.resolve(overrides.reply ?? 'Objective: grow reach.\n1. Do X.')) };
  const service = new AiStrategyService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    foundry as unknown as AzureAiFoundryService,
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, audit, foundry, notifications, request };
}

describe('AiStrategyService', () => {
  describe('create', () => {
    it('notifies reviewers (Owner/Admin + client-scoped Managers), excluding the requester (NOTIF-1)', async () => {
      const { service, prisma, notifications } = buildService();
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'owner-1' }, { id: 'actor-1' }]);
      prisma.userClientAccess.findMany.mockResolvedValueOnce([{ userId: 'manager-1' }]);
      await service.create('client-1', 'actor-1', { title: 'New strategy' } as any);
      expect(notifications.createMany).toHaveBeenCalledWith(
        expect.arrayContaining(['owner-1', 'manager-1']),
        expect.stringContaining('New strategy'),
        '/ai-strategy',
      );
      const [recipients] = notifications.createMany.mock.calls[0];
      expect(recipients).not.toContain('actor-1');
    });
  });

  it('rejects operating on a request from a different client', async () => {
    const { service } = buildService({ request: { id: 'req-1', clientId: 'other-client' } });
    await expect(service.getOne('client-1', 'req-1')).rejects.toThrow(
      'Strategy request not found for this client',
    );
  });

  it('getOne includes the full generation history, most recent first', async () => {
    const { service, prisma } = buildService();
    await service.getOne('client-1', 'req-1');
    expect(prisma.aiStrategyRequest.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        include: { generations: { orderBy: { createdAt: 'desc' } } },
      }),
    );
  });

  it('rejects reviewing a request that has not been generated yet', async () => {
    const { service, prisma } = buildService({
      request: { id: 'req-1', clientId: 'client-1', status: AiStrategyStatus.DRAFT },
    });
    await expect(
      service.review('client-1', 'req-1', 'actor-1', { status: AiStrategyStatus.APPROVED } as any),
    ).rejects.toThrow('Only a generated strategy can be reviewed');
    expect(prisma.aiStrategyRequest.update).not.toHaveBeenCalled();
  });

  it('logs an APPROVED audit action when the reviewer approves', async () => {
    const { service, audit } = buildService();
    await service.review('client-1', 'req-1', 'actor-1', { status: AiStrategyStatus.APPROVED } as any);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AI_STRATEGY_APPROVED' }));
  });

  it('notifies the requester when their strategy is reviewed (NOTIF-1)', async () => {
    const { service, notifications } = buildService({
      request: {
        id: 'req-1',
        clientId: 'client-1',
        title: 'Q1 push',
        status: AiStrategyStatus.GENERATED,
        createdById: 'creator-1',
      },
    });
    await service.review('client-1', 'req-1', 'actor-1', { status: AiStrategyStatus.APPROVED } as any);
    expect(notifications.create).toHaveBeenCalledWith(
      'creator-1',
      expect.stringContaining('approved'),
      '/ai-strategy',
    );
  });

  it('does not notify when the reviewer is also the requester', async () => {
    const { service, notifications } = buildService({
      request: {
        id: 'req-1',
        clientId: 'client-1',
        title: 'Q1 push',
        status: AiStrategyStatus.GENERATED,
        createdById: 'actor-1',
      },
    });
    await service.review('client-1', 'req-1', 'actor-1', { status: AiStrategyStatus.APPROVED } as any);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('logs a REJECTED audit action for any other review status', async () => {
    const { service, audit } = buildService();
    await service.review('client-1', 'req-1', 'actor-1', { status: AiStrategyStatus.REJECTED } as any);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AI_STRATEGY_REJECTED' }));
  });

  describe('generate', () => {
    it('stores the model output and marks the request GENERATED', async () => {
      const { service, prisma } = buildService({ reply: 'Objective: grow reach.\n1. Post daily.' });
      const updated = await service.generate('client-1', 'req-1', 'actor-1');
      expect(updated.output).toBe('Objective: grow reach.\n1. Post daily.');
      expect(prisma.aiStrategyRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: AiStrategyStatus.GENERATED }) }),
      );
    });

    it('appends a generation history row instead of only overwriting output', async () => {
      const { service, prisma } = buildService({ reply: 'Objective: grow reach.\n1. Post daily.' });
      await service.generate('client-1', 'req-1', 'actor-1');
      expect(prisma.aiStrategyGeneration.create).toHaveBeenCalledWith({
        data: { requestId: 'req-1', output: 'Objective: grow reach.\n1. Post daily.' },
      });
      // Both writes happen atomically in one transaction, not as two independent calls that
      // could leave output/status and the history row inconsistent if one failed.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('passes the title, goal, and context note through to the prompt', async () => {
      const { service, foundry } = buildService({
        request: {
          id: 'req-1',
          clientId: 'client-1',
          title: 'Spring Launch',
          goal: 'drive signups',
          context: { note: 'targeting first-time buyers' },
          status: AiStrategyStatus.DRAFT,
        },
      });
      await service.generate('client-1', 'req-1', 'actor-1');
      const [messages] = foundry.chat.mock.calls[0];
      const userMessage = messages.find((m: any) => m.role === 'user').content;
      expect(userMessage).toContain('Spring Launch');
      expect(userMessage).toContain('drive signups');
      expect(userMessage).toContain('targeting first-time buyers');
    });
  });
});
