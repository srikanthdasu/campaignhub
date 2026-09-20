import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClientAccessGuard } from './client-access.guard.js';
import { Role } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { ExecutionContext } from '@nestjs/common';

function buildContext(user: unknown, clientId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params: { clientId } }) }),
  } as unknown as ExecutionContext;
}

function buildGuard(client: Record<string, unknown> | null, access: Record<string, unknown> | null = null) {
  const prisma = {
    client: { findUnique: vi.fn(() => Promise.resolve(client)) },
    userClientAccess: { findUnique: vi.fn(() => Promise.resolve(access)) },
  };
  return { guard: new ClientAccessGuard(prisma as unknown as PrismaService), prisma };
}

describe('ClientAccessGuard', () => {
  it('rejects a client belonging to a different agency', async () => {
    const { guard } = buildGuard({ id: 'client-1', agencyId: 'agency-2' });
    const user = { sub: 'u1', agencyId: 'agency-1', role: Role.OWNER };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).rejects.toThrow(
      'Client belongs to a different agency',
    );
  });

  it('grants OWNER full access once the agency matches', async () => {
    const { guard } = buildGuard({ id: 'client-1', agencyId: 'agency-1' });
    const user = { sub: 'u1', agencyId: 'agency-1', role: Role.OWNER };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).resolves.toBe(true);
  });

  it('grants SUPER_ADMIN full access once its agencyId matches (post-switch)', async () => {
    const { guard, prisma } = buildGuard({ id: 'client-1', agencyId: 'agency-2' });
    const user = { sub: 'super-admin-1', agencyId: 'agency-2', role: Role.SUPER_ADMIN };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).resolves.toBe(true);
    // No UserClientAccess grant required — same short-circuit as OWNER/ADMIN.
    expect(prisma.userClientAccess.findUnique).not.toHaveBeenCalled();
  });

  it('still rejects SUPER_ADMIN for an agency it has not switched into', async () => {
    const { guard } = buildGuard({ id: 'client-1', agencyId: 'agency-2' });
    const user = { sub: 'super-admin-1', agencyId: 'agency-1', role: Role.SUPER_ADMIN };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).rejects.toThrow(
      'Client belongs to a different agency',
    );
  });

  it('requires an explicit UserClientAccess grant for a non-elevated role', async () => {
    const { guard } = buildGuard({ id: 'client-1', agencyId: 'agency-1' }, null);
    const user = { sub: 'u1', agencyId: 'agency-1', role: Role.CREATOR };
    await expect(guard.canActivate(buildContext(user, 'client-1'))).rejects.toThrow(
      'You do not have access to this client',
    );
  });

  it('404s when the client does not exist', async () => {
    const { guard } = buildGuard(null);
    const user = { sub: 'u1', agencyId: 'agency-1', role: Role.OWNER };
    await expect(guard.canActivate(buildContext(user, 'missing'))).rejects.toThrow(NotFoundException);
  });
});
