import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClientAccessGuard } from './client-access.guard.js';
import { Role } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { ExecutionContext } from '@nestjs/common';

function buildContext(user: unknown, clientId: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { clientId } }),
    }),
  } as unknown as ExecutionContext;
}

function buildGuard(client: Record<string, unknown> | null, access: unknown) {
  const prisma = {
    client: { findUnique: vi.fn(() => Promise.resolve(client)) },
    userClientAccess: { findUnique: vi.fn(() => Promise.resolve(access)) },
  };
  return { guard: new ClientAccessGuard(prisma as unknown as PrismaService), prisma };
}

describe('ClientAccessGuard', () => {
  it('lets OWNER/ADMIN through regardless of a per-user access grant', async () => {
    const { guard } = buildGuard({ id: 'client-1', agencyId: 'agency-1' }, null);
    const user = { sub: 'user-1', agencyId: 'agency-1', role: Role.OWNER };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).resolves.toBe(true);
  });

  it('rejects a CLIENT-role user when portal access is disabled, even with a grant', async () => {
    const { guard } = buildGuard(
      { id: 'client-1', agencyId: 'agency-1', allowClientPortalAccess: false },
      { userId: 'user-1', clientId: 'client-1' },
    );
    const user = { sub: 'user-1', agencyId: 'agency-1', role: Role.CLIENT };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).rejects.toThrow(ForbiddenException);
  });

  it('allows a CLIENT-role user through when portal access is enabled and they have a grant', async () => {
    const { guard } = buildGuard(
      { id: 'client-1', agencyId: 'agency-1', allowClientPortalAccess: true },
      { userId: 'user-1', clientId: 'client-1' },
    );
    const user = { sub: 'user-1', agencyId: 'agency-1', role: Role.CLIENT };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).resolves.toBe(true);
  });

  it('does not gate non-CLIENT roles on the portal access toggle', async () => {
    const { guard } = buildGuard(
      { id: 'client-1', agencyId: 'agency-1', allowClientPortalAccess: false },
      { userId: 'user-1', clientId: 'client-1' },
    );
    const user = { sub: 'user-1', agencyId: 'agency-1', role: Role.MANAGER };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).resolves.toBe(true);
  });

  it('404s when the client does not exist', async () => {
    const { guard } = buildGuard(null, null);
    const user = { sub: 'user-1', agencyId: 'agency-1', role: Role.MANAGER };
    await expect(guard.canActivate(buildContext(user, 'missing'))).rejects.toThrow(NotFoundException);
  });
});
