import { describe, expect, it, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { AiSpendCapGuard } from './ai-spend-cap.guard.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../types/authenticated-user.js';
import { Role } from '../../generated/prisma/client.js';

function buildContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { sub: 'user-1', email: 'a@b.com', role: Role.CREATOR, agencyId: 'agency-1', ...overrides };
}

function buildGuard(count: number, capOverride?: string) {
  const prisma = {
    aiUsageLog: {
      count: vi.fn((_args: any) => Promise.resolve(count)),
      create: vi.fn((_args: any) => Promise.resolve({})),
    },
  };
  const config = { get: vi.fn(() => capOverride) };
  const guard = new AiSpendCapGuard(prisma as unknown as PrismaService, config as unknown as ConfigService);
  return { guard, prisma, config };
}

describe('AiSpendCapGuard', () => {
  it('allows the request and logs it when under the default cap', async () => {
    const { guard, prisma } = buildGuard(3);
    await expect(guard.canActivate(buildContext(makeUser()))).resolves.toBe(true);
    expect(prisma.aiUsageLog.create).toHaveBeenCalledWith({ data: { agencyId: 'agency-1' } });
  });

  it('scopes the count to today (UTC) for this agency', async () => {
    const { guard, prisma } = buildGuard(3);
    await guard.canActivate(buildContext(makeUser()));
    expect(prisma.aiUsageLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          agencyId: 'agency-1',
          createdAt: { gte: expect.any(Date) },
        }),
      }),
    );
    const call = prisma.aiUsageLog.count.mock.calls[0]!;
    const since: Date = call[0].where.createdAt.gte;
    expect(since.getUTCHours()).toBe(0);
    expect(since.getUTCMinutes()).toBe(0);
  });

  it('rejects once the default cap (500) is reached, without logging another row', async () => {
    const { guard, prisma } = buildGuard(500);
    await expect(guard.canActivate(buildContext(makeUser()))).rejects.toThrow(
      "reached today's AI generation limit (500)",
    );
    expect(prisma.aiUsageLog.create).not.toHaveBeenCalled();
  });

  it('respects a configured cap override', async () => {
    const { guard } = buildGuard(10, '10');
    await expect(guard.canActivate(buildContext(makeUser()))).rejects.toThrow(
      "reached today's AI generation limit (10)",
    );
  });

  it('lets a request with no authenticated user through untouched (JwtAuthGuard already gates this)', async () => {
    const { guard, prisma } = buildGuard(999);
    await expect(guard.canActivate(buildContext(undefined))).resolves.toBe(true);
    expect(prisma.aiUsageLog.count).not.toHaveBeenCalled();
  });

  it('never blocks two different agencies from each other — the count is agency-scoped', async () => {
    const { guard, prisma } = buildGuard(0);
    await guard.canActivate(buildContext(makeUser({ agencyId: 'agency-2' })));
    expect(prisma.aiUsageLog.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agencyId: 'agency-2' }) }),
    );
  });
});
