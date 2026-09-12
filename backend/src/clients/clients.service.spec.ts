import { describe, expect, it, vi } from 'vitest';
import { ClientsService } from './clients.service.js';
import { ClientGroupRole, Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { sub: 'user-1', email: 'a@b.com', role: Role.CREATOR, agencyId: 'agency-1', ...overrides };
}

function buildService(
  overrides: { client?: any; targetUser?: any; existingAccess?: any } = {},
) {
  const audit = { log: vi.fn() };
  const prisma = {
    client: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'client-1', ...args.data })),
      findUnique: vi.fn(() =>
        Promise.resolve(overrides.client ?? { id: 'client-1', agencyId: 'agency-1', name: 'Client' }),
      ),
      findMany: vi.fn(() => Promise.resolve([])),
      update: vi.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    userClientAccess: {
      findMany: vi.fn(() => Promise.resolve([])),
      findUnique: vi.fn(() =>
        Promise.resolve(
          'existingAccess' in overrides
            ? overrides.existingAccess
            : { userId: 'target-1', clientId: 'client-1', role: ClientGroupRole.VIEWER },
        ),
      ),
      upsert: vi.fn(() => Promise.resolve({})),
      update: vi.fn(() => Promise.resolve({})),
      deleteMany: vi.fn(() => Promise.resolve({})),
    },
    user: {
      findUnique: vi.fn(() =>
        Promise.resolve(overrides.targetUser ?? { id: 'target-1', agencyId: 'agency-1' }),
      ),
      findMany: vi.fn(() => Promise.resolve([])),
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
        expect.objectContaining({ where: { agencyId: 'agency-1', deletedAt: null } }),
      );
    });

    it('restricts other roles to clients they have explicit access to', async () => {
      const { service, prisma } = buildService();
      await service.listForUser(makeUser({ role: Role.CREATOR }));
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agencyId: 'agency-1', deletedAt: null, userAccess: { some: { userId: 'user-1' } } },
        }),
      );
    });
  });

  describe('softDelete / restore / purgeExpired', () => {
    it('soft-deletes a client by setting deletedAt', async () => {
      const { service, prisma, audit } = buildService({ client: { id: 'client-1', agencyId: 'agency-1', deletedAt: null } });
      await service.softDelete('agency-1', 'actor-1', 'client-1');
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CLIENT_DELETED' }));
    });

    it('rejects deleting a client that is already deleted', async () => {
      const { service } = buildService({
        client: { id: 'client-1', agencyId: 'agency-1', deletedAt: new Date() },
      });
      await expect(service.softDelete('agency-1', 'actor-1', 'client-1')).rejects.toThrow(
        'Client is already deleted',
      );
    });

    it('restores a soft-deleted client', async () => {
      const { service, prisma, audit } = buildService({
        client: { id: 'client-1', agencyId: 'agency-1', deletedAt: new Date() },
      });
      await service.restore('agency-1', 'actor-1', 'client-1');
      expect(prisma.client.update).toHaveBeenCalledWith({ where: { id: 'client-1' }, data: { deletedAt: null } });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CLIENT_RESTORED' }));
    });

    it('rejects restoring a client that is not deleted', async () => {
      const { service } = buildService({ client: { id: 'client-1', agencyId: 'agency-1', deletedAt: null } });
      await expect(service.restore('agency-1', 'actor-1', 'client-1')).rejects.toThrow('Client is not deleted');
    });

    it('purges only clients past the grace period and audits the batch', async () => {
      const { service, prisma, audit } = buildService();
      prisma.client.findMany.mockResolvedValueOnce([
        { id: 'client-1', name: 'Old Co', agencyId: 'agency-1' },
      ] as never);
      const count = await service.purgeExpired(15);
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: { lt: expect.any(Date) } } }),
      );
      expect(prisma.client.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['client-1'] } } });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CLIENT_PURGED', agencyId: 'agency-1' }),
      );
      expect(count).toBe(1);
    });

    it('writes one audit entry per agency when a batch spans multiple agencies', async () => {
      const { service, prisma, audit } = buildService();
      prisma.client.findMany.mockResolvedValueOnce([
        { id: 'client-1', name: 'Old Co', agencyId: 'agency-1' },
        { id: 'client-2', name: 'Older Co', agencyId: 'agency-2' },
      ] as never);
      await service.purgeExpired(15);
      expect(audit.log).toHaveBeenCalledTimes(2);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ agencyId: 'agency-1', entityId: 'client-1' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ agencyId: 'agency-2', entityId: 'client-2' }),
      );
    });

    it('skips the delete and audit call when nothing is due for purge', async () => {
      const { service, prisma, audit } = buildService();
      const count = await service.purgeExpired(15);
      expect(prisma.client.deleteMany).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });
  });

  describe('update / listAccess / grantAccess / revokeAccess', () => {
    it('rejects a client from a different agency', async () => {
      const { service } = buildService({ client: { id: 'client-1', agencyId: 'agency-2' } });
      await expect(service.update('agency-1', 'actor-1', 'client-1', { name: 'x' } as any)).rejects.toThrow(
        'Client not found in this agency',
      );
    });

    it('grants access after confirming the target user is in the same agency, defaulting to VIEWER', async () => {
      const { service, prisma } = buildService({ targetUser: { id: 'target-1', agencyId: 'agency-1' } });
      await service.grantAccess('agency-1', 'actor-1', 'client-1', 'target-1');
      expect(prisma.userClientAccess.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { userId: 'target-1', clientId: 'client-1', role: ClientGroupRole.VIEWER },
          update: { role: ClientGroupRole.VIEWER },
        }),
      );
    });

    it('grants access with an explicit per-client role', async () => {
      const { service, prisma } = buildService({ targetUser: { id: 'target-1', agencyId: 'agency-1' } });
      await service.grantAccess('agency-1', 'actor-1', 'client-1', 'target-1', ClientGroupRole.APPROVER);
      expect(prisma.userClientAccess.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { userId: 'target-1', clientId: 'client-1', role: ClientGroupRole.APPROVER },
          update: { role: ClientGroupRole.APPROVER },
        }),
      );
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

    it('lists access with the per-client accessRole flattened onto the user', async () => {
      const { service, prisma } = buildService();
      prisma.userClientAccess.findMany.mockResolvedValueOnce([
        { role: ClientGroupRole.MANAGER, user: { id: 'u1', name: 'A', email: 'a@b.com', role: Role.CREATOR } },
      ] as never);
      const result = await service.listAccess('agency-1', 'client-1');
      expect(result).toEqual([
        { id: 'u1', name: 'A', email: 'a@b.com', role: Role.CREATOR, accessRole: ClientGroupRole.MANAGER },
      ]);
    });
  });

  describe('updateAccessRole', () => {
    it('updates the role on an existing access grant', async () => {
      const { service, prisma, audit } = buildService({
        existingAccess: { userId: 'target-1', clientId: 'client-1', role: ClientGroupRole.VIEWER },
      });
      await service.updateAccessRole('agency-1', 'actor-1', 'client-1', 'target-1', ClientGroupRole.APPROVER);
      expect(prisma.userClientAccess.update).toHaveBeenCalledWith({
        where: { userId_clientId: { userId: 'target-1', clientId: 'client-1' } },
        data: { role: ClientGroupRole.APPROVER },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CLIENT_ACCESS_ROLE_CHANGED' }),
      );
    });

    it('rejects updating a role when no access grant exists', async () => {
      const { service, prisma } = buildService({ existingAccess: null });
      await expect(
        service.updateAccessRole('agency-1', 'actor-1', 'client-1', 'target-1', ClientGroupRole.APPROVER),
      ).rejects.toThrow('This user does not have access to this client');
      expect(prisma.userClientAccess.update).not.toHaveBeenCalled();
    });
  });

  describe('getAccessOverview', () => {
    it('groups members by client and separates out unassigned members', async () => {
      const { service, prisma } = buildService();
      prisma.client.findMany.mockResolvedValueOnce([
        {
          id: 'client-1',
          name: 'Client One',
          userAccess: [
            {
              userId: 'u1',
              role: ClientGroupRole.MANAGER,
              user: { id: 'u1', name: 'A', email: 'a@b.com', role: Role.CREATOR, isActive: true },
            },
          ],
        },
      ] as never);
      prisma.user.findMany.mockResolvedValueOnce([
        { id: 'u1', name: 'A', email: 'a@b.com', role: Role.CREATOR, isActive: true },
        { id: 'u2', name: 'B', email: 'b@b.com', role: Role.OWNER, isActive: true },
      ] as never);

      const result = await service.getAccessOverview('agency-1');

      expect(result.totalClients).toBe(1);
      expect(result.totalMembers).toBe(2);
      expect(result.unassignedCount).toBe(1);
      expect(result.clients).toEqual([
        {
          id: 'client-1',
          name: 'Client One',
          members: [{ id: 'u1', name: 'A', email: 'a@b.com', role: Role.CREATOR, isActive: true, accessRole: ClientGroupRole.MANAGER }],
        },
      ]);
      expect(result.unassigned).toEqual([
        { id: 'u2', name: 'B', email: 'b@b.com', role: Role.OWNER, isActive: true },
      ]);
    });
  });
});
