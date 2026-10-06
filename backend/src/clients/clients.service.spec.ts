import { describe, expect, it, vi } from 'vitest';
import { ClientsService } from './clients.service.js';
import { ClientGroupRole, Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { sub: 'user-1', email: 'a@b.com', role: Role.CREATOR, agencyId: 'agency-1', ...overrides };
}

function buildService(
  overrides: { client?: any; targetUser?: any; existingAccess?: any } = {},
) {
  const audit = { log: vi.fn() };
  const prisma = {
    // Array-form $transaction: the real client already has each operation's promise constructed
    // by the time it reaches here, so awaiting them together (and propagating a rejection, same
    // as a real rolled-back transaction) is a faithful mock of Prisma's own semantics.
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    client: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'client-1', ...args.data })),
      findUnique: vi.fn(() =>
        Promise.resolve(overrides.client ?? { id: 'client-1', agencyId: 'agency-1', name: 'Client' }),
      ),
      findMany: vi.fn((_args: any) => Promise.resolve([])),
      update: vi.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      delete: vi.fn((args: any) => Promise.resolve({ id: args.where.id })),
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    approvalFlow: {
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
  const notifications = { create: vi.fn(), createMany: vi.fn() };
  const service = new ClientsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, audit, notifications };
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

    it('purges a client with no approval history: deletes it in its own transaction and audits it', async () => {
      const { service, prisma, audit } = buildService();
      prisma.client.findMany.mockResolvedValueOnce([
        { id: 'client-1', name: 'Old Co', agencyId: 'agency-1' },
      ] as never);

      const count = await service.purgeExpired(15);

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: { lt: expect.any(Date) } } }),
      );
      // Each client's cleanup + delete runs as one transaction — never the old whole-batch deleteMany.
      expect(prisma.client.deleteMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.approvalFlow.deleteMany).toHaveBeenCalledWith({
        where: { contentItem: { clientId: 'client-1' } },
      });
      expect(prisma.client.delete).toHaveBeenCalledWith({ where: { id: 'client-1' } });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CLIENT_PURGED', agencyId: 'agency-1', entityId: 'client-1' }),
      );
      expect(count).toBe(1);
    });

    it('deletes a client with approval history: ApprovalFlow cleanup runs in the same transaction as the client delete', async () => {
      // ApprovalStep rows cascading away is a real database FK behavior (ApprovalStep.approvalFlow
      // is ON DELETE CASCADE), not something a unit test with a mocked Prisma client can observe —
      // verified instead against the real database in the P1-2 runtime verification. What this
      // test can and does verify: the approvalFlow.deleteMany scoped to this exact client's content
      // items is bundled into the same $transaction as the client delete itself.
      const { service, prisma, audit } = buildService();
      prisma.client.findMany.mockResolvedValueOnce([
        { id: 'client-with-approvals', name: 'Approved Co', agencyId: 'agency-1' },
      ] as never);
      prisma.approvalFlow.deleteMany = vi.fn(() => Promise.resolve({ count: 3 })) as any;

      const count = await service.purgeExpired(15);

      const [transactionOps] = prisma.$transaction.mock.calls[0]!;
      expect(transactionOps).toHaveLength(2);
      expect(prisma.approvalFlow.deleteMany).toHaveBeenCalledWith({
        where: { contentItem: { clientId: 'client-with-approvals' } },
      });
      expect(prisma.client.delete).toHaveBeenCalledWith({ where: { id: 'client-with-approvals' } });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CLIENT_PURGED', entityId: 'client-with-approvals' }),
      );
      expect(count).toBe(1);
    });

    it('rolls back and skips the audit entry when a client transaction fails, without throwing', async () => {
      const { service, prisma, audit } = buildService();
      prisma.client.findMany.mockResolvedValueOnce([
        { id: 'stuck-client', name: 'Stuck Co', agencyId: 'agency-1' },
      ] as never);
      // Simulates the client.delete leg of the transaction failing (e.g. an FK violation that
      // wasn't actually cleaned up) — Promise.all in the mock rejects exactly like a real
      // transaction rolling back every operation in it, including the approvalFlow.deleteMany.
      prisma.client.delete = vi.fn(() => Promise.reject(new Error('FK violation'))) as any;

      const count = await service.purgeExpired(15);

      expect(count).toBe(0);
      expect(audit.log).not.toHaveBeenCalled();
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

    it('writes one audit entry per client — not a joined id string — when one agency has 2+ clients expire together', async () => {
      // Regression test: entityId is a strict UUID column. The previous implementation joined
      // multiple client ids into one comma-separated entityId per agency, which would have
      // thrown here (after the delete already committed) the moment an agency had 2+ expired
      // clients in the same run.
      const { service, prisma, audit } = buildService();
      prisma.client.findMany.mockResolvedValueOnce([
        { id: 'client-1', name: 'Old Co', agencyId: 'agency-1' },
        { id: 'client-2', name: 'Older Co', agencyId: 'agency-1' },
      ] as never);
      await service.purgeExpired(15);
      expect(audit.log).toHaveBeenCalledTimes(2);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ agencyId: 'agency-1', entityId: 'client-1' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ agencyId: 'agency-1', entityId: 'client-2' }),
      );
    });

    it('one client failing does not block the others in the same run — A and C still purge when B fails', async () => {
      const { service, prisma, audit } = buildService();
      prisma.client.findMany.mockResolvedValueOnce([
        { id: 'client-a', name: 'A Co', agencyId: 'agency-1' },
        { id: 'client-b', name: 'B Co', agencyId: 'agency-1' },
        { id: 'client-c', name: 'C Co', agencyId: 'agency-1' },
      ] as never);
      prisma.client.delete = vi.fn((args: any) =>
        args.where.id === 'client-b'
          ? Promise.reject(new Error('FK violation for B'))
          : Promise.resolve({ id: args.where.id }),
      ) as any;

      const count = await service.purgeExpired(15);

      expect(count).toBe(2); // A and C, not B
      expect(prisma.$transaction).toHaveBeenCalledTimes(3); // all three were attempted, independently
      expect(audit.log).toHaveBeenCalledTimes(2);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'client-a' }));
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'client-c' }));
      expect(audit.log).not.toHaveBeenCalledWith(expect.objectContaining({ entityId: 'client-b' }));
    });

    it('skips the delete and audit call when nothing is due for purge', async () => {
      const { service, prisma, audit } = buildService();
      const count = await service.purgeExpired(15);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });
  });

  describe('warnBeforePurge (NOTIF-1)', () => {
    it('notifies agency Owners/Admins for a client entering the warning window', async () => {
      const { service, prisma, notifications } = buildService();
      prisma.client.findMany.mockResolvedValueOnce([
        { id: 'client-1', name: 'Soon Gone Co', agencyId: 'agency-1' },
      ] as never);
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'owner-1' }, { id: 'admin-1' }] as never);

      const count = await service.warnBeforePurge(15, 3);

      expect(count).toBe(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agencyId: 'agency-1', role: { in: [Role.OWNER, Role.ADMIN] } }),
        }),
      );
      expect(notifications.createMany).toHaveBeenCalledWith(
        ['owner-1', 'admin-1'],
        expect.stringContaining('Soon Gone Co'),
        '/admin/agency',
      );
    });

    it('does nothing when no client is in the warning window', async () => {
      const { service, notifications } = buildService();
      const count = await service.warnBeforePurge(15, 3);
      expect(count).toBe(0);
      expect(notifications.createMany).not.toHaveBeenCalled();
    });

    it('queries a narrow window that excludes clients already past the purge cutoff', async () => {
      const { service, prisma } = buildService();
      await service.warnBeforePurge(15, 3);
      const call = prisma.client.findMany.mock.calls[0]!;
      const { gte, lt } = (call[0] as { where: { deletedAt: { gte: Date; lt: Date } } }).where.deletedAt;
      expect(lt.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000);
      // 15 - 3 = 12 days ago is the boundary — a client deleted exactly then gets warned once.
      const expectedLt = Date.now() - 12 * 24 * 60 * 60 * 1000;
      expect(Math.abs(lt.getTime() - expectedLt)).toBeLessThan(5000);
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

    it('notifies the target user when access is granted (NOTIF-1)', async () => {
      const { service, notifications } = buildService({ targetUser: { id: 'target-1', agencyId: 'agency-1' } });
      await service.grantAccess('agency-1', 'actor-1', 'client-1', 'target-1');
      expect(notifications.create).toHaveBeenCalledWith('target-1', expect.stringContaining('Client'));
    });

    it('revokes access scoped to the client', async () => {
      const { service, prisma } = buildService();
      await service.revokeAccess('agency-1', 'actor-1', 'client-1', 'target-1');
      expect(prisma.userClientAccess.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'target-1', clientId: 'client-1' },
      });
    });

    it('notifies the target user when access is revoked (NOTIF-1)', async () => {
      const { service, notifications } = buildService();
      await service.revokeAccess('agency-1', 'actor-1', 'client-1', 'target-1');
      expect(notifications.create).toHaveBeenCalledWith('target-1', expect.stringContaining('revoked'));
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

    it('notifies the target user when their access role changes (NOTIF-1)', async () => {
      const { service, notifications } = buildService({
        existingAccess: { userId: 'target-1', clientId: 'client-1', role: ClientGroupRole.VIEWER },
      });
      await service.updateAccessRole('agency-1', 'actor-1', 'client-1', 'target-1', ClientGroupRole.APPROVER);
      expect(notifications.create).toHaveBeenCalledWith('target-1', expect.stringContaining('APPROVER'));
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
