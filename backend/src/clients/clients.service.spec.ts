import { describe, expect, it, vi } from 'vitest';
import { ClientsService } from './clients.service.js';
import { Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { sub: 'user-1', email: 'a@b.com', role: Role.CREATOR, agencyId: 'agency-1', ...overrides };
}

function buildService(overrides: { client?: any; targetUser?: any } = {}) {
  const audit = { log: vi.fn() };
  const prisma = {
    client: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'client-1', ...args.data })),
      findUnique: vi.fn(() =>
        Promise.resolve(overrides.client ?? { id: 'client-1', agencyId: 'agency-1', name: 'Client' }),
      ),
      findMany: vi.fn(() => Promise.resolve([])),
      update: vi.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
    },
    userClientAccess: {
      findMany: vi.fn(() => Promise.resolve([])),
      upsert: vi.fn(() => Promise.resolve({})),
      deleteMany: vi.fn(() => Promise.resolve({})),
    },
    user: {
      findUnique: vi.fn(() =>
        Promise.resolve(overrides.targetUser ?? { id: 'target-1', agencyId: 'agency-1' }),
      ),
    },
  };
  const service = new ClientsService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, audit };
}

describe('ClientsService', () => {
  describe('listForUser', () => {
    it('gives OWNER/ADMIN every client in the agency', async () => {
      const { service, prisma } = buildService();
      await service.listForUser(makeUser({ role: Role.OWNER }));
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { agencyId: 'agency-1' } }),
      );
    });

    it('restricts other roles to clients they have explicit access to', async () => {
      const { service, prisma } = buildService();
      await service.listForUser(makeUser({ role: Role.CREATOR }));
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agencyId: 'agency-1', userAccess: { some: { userId: 'user-1' } } },
        }),
      );
    });
  });

  describe('update / listAccess / grantAccess / revokeAccess', () => {
    it('rejects a client from a different agency', async () => {
      const { service } = buildService({ client: { id: 'client-1', agencyId: 'agency-2' } });
      await expect(service.update('agency-1', 'actor-1', 'client-1', { name: 'x' } as any)).rejects.toThrow(
        'Client not found in this agency',
      );
    });

    it('grants access after confirming the target user is in the same agency', async () => {
      const { service, prisma } = buildService({ targetUser: { id: 'target-1', agencyId: 'agency-1' } });
      await service.grantAccess('agency-1', 'actor-1', 'client-1', 'target-1');
      expect(prisma.userClientAccess.upsert).toHaveBeenCalled();
    });

    it('rejects granting access to a user from a different agency', async () => {
      const { service, prisma } = buildService({ targetUser: { id: 'target-1', agencyId: 'agency-2' } });
      await expect(service.grantAccess('agency-1', 'actor-1', 'client-1', 'target-1')).rejects.toThrow(
        'User does not belong to this agency',
      );
      expect(prisma.userClientAccess.upsert).not.toHaveBeenCalled();
    });

    it('revokes access scoped to the client', async () => {
      const { service, prisma } = buildService();
      await service.revokeAccess('agency-1', 'actor-1', 'client-1', 'target-1');
      expect(prisma.userClientAccess.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'target-1', clientId: 'client-1' },
      });
    });
  });
});
