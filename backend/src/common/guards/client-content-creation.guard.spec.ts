import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClientContentCreationGuard } from './client-content-creation.guard.js';
import { Role } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { ExecutionContext } from '@nestjs/common';

function buildContext(user: unknown, clientId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { clientId } }),
    }),
  } as unknown as ExecutionContext;
}

function buildGuard(client: Record<string, unknown> | null) {
  const prisma = { client: { findUnique: vi.fn(() => Promise.resolve(client)) } };
  return { guard: new ClientContentCreationGuard(prisma as unknown as PrismaService), prisma };
}

describe('ClientContentCreationGuard', () => {
  it('is a no-op for non-CLIENT roles, regardless of the flag', async () => {
    const { guard, prisma } = buildGuard({ id: 'client-1', allowClientContentCreation: false });
    const user = { sub: 'user-1', agencyId: 'agency-1', role: Role.MANAGER };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).resolves.toBe(true);
    expect(prisma.client.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a CLIENT-role user when the flag is off', async () => {
    const { guard } = buildGuard({ id: 'client-1', allowClientContentCreation: false });
    const user = { sub: 'user-1', agencyId: 'agency-1', role: Role.CLIENT };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).rejects.toThrow(ForbiddenException);
  });

  it('allows a CLIENT-role user through when the flag is on', async () => {
    const { guard } = buildGuard({ id: 'client-1', allowClientContentCreation: true });
    const user = { sub: 'user-1', agencyId: 'agency-1', role: Role.CLIENT };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).resolves.toBe(true);
  });

  it('404s when the client does not exist', async () => {
    const { guard } = buildGuard(null);
    const user = { sub: 'user-1', agencyId: 'agency-1', role: Role.CLIENT };
    await expect(guard.canActivate(buildContext(user, 'missing'))).rejects.toThrow(NotFoundException);
  });

  it('passes through when there is no user on the request — auth is enforced elsewhere', async () => {
    const { guard, prisma } = buildGuard({ id: 'client-1', allowClientContentCreation: true });
    await expect(guard.canActivate(buildContext(undefined, 'client-1'))).resolves.toBe(true);
    expect(prisma.client.findUnique).not.toHaveBeenCalled();
  });
});
