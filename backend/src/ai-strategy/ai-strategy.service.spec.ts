import { describe, expect, it, vi } from 'vitest';
import { AiStrategyService } from './ai-strategy.service.js';
import { AiStrategyStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AzureAiFoundryService } from '../ai-common/azure-ai-foundry.service.js';

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
  const prisma = {
    aiStrategyRequest: {
      findUnique: vi.fn(() => Promise.resolve(request)),
      update: vi.fn((args: any) => Promise.resolve({ ...request, ...args.data })),
      delete: vi.fn(() => Promise.resolve({})),
    },
  };
  const foundry = { chat: vi.fn(() => Promise.resolve(overrides.reply ?? 'Objective: grow reach.\n1. Do X.')) };
  const service = new AiStrategyService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    foundry as unknown as AzureAiFoundryService,
  );
  return { service, prisma, audit, foundry, request };
}

describe('AiStrategyService', () => {
  it('rejects operating on a request from a different client', async () => {
    const { service } = buildService({ request: { id: 'req-1', clientId: 'other-client' } });
    await expect(service.getOne('client-1', 'req-1')).rejects.toThrow(
      'Strategy request not found for this client',
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
