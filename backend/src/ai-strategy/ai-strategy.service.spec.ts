import { describe, expect, it, vi } from 'vitest';
import { AiStrategyService } from './ai-strategy.service.js';
import { AiStrategyStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

function buildService(overrides: { request?: any } = {}) {
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
  const service = new AiStrategyService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, audit, request };
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
});
