import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

function buildService(overrides: { user?: { agencyId: string } | null } = {}) {
  const prisma = {
    auditLog: {
      create: vi.fn(() => Promise.resolve({})),
      findMany: vi.fn(() => Promise.resolve([])),
      deleteMany: vi.fn((_args: { where: { createdAt: { lt: Date } } }) => Promise.resolve({ count: 0 })),
    },
    user: {
      findUnique: vi.fn(() => Promise.resolve(overrides.user ?? { agencyId: 'agency-1' })),
    },
  };
  const service = new AuditService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('AuditService.log', () => {
  it('derives agencyId from userId when not passed explicitly', async () => {
    const { service, prisma } = buildService({ user: { agencyId: 'agency-1' } });
    await service.log({ userId: 'user-1', action: 'THING_HAPPENED' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { agencyId: true },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ agencyId: 'agency-1', userId: 'user-1' }) }),
    );
  });

  it('uses an explicitly-passed agencyId without looking up the user (unattended cron/webhook paths)', async () => {
    const { service, prisma } = buildService();
    await service.log({ agencyId: 'agency-2', action: 'CLIENT_PURGED' });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ agencyId: 'agency-2', userId: null }) }),
    );
  });

  it('leaves agencyId null when there is neither a userId nor an explicit agencyId', async () => {
    const { service, prisma } = buildService();
    await service.log({ action: 'SOMETHING_UNATTRIBUTED' });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ agencyId: null }) }),
    );
  });

  it('never throws when the write itself fails — audit logging must not undo a real business action (AUDIT-2)', async () => {
    const { service, prisma } = buildService();
    prisma.auditLog.create = vi.fn(() => Promise.reject(new Error('DB hiccup')));
    const Sentry = await import('@sentry/nestjs');

    await expect(service.log({ agencyId: 'agency-1', action: 'SUBSCRIPTION_ACTIVATED' })).resolves.toBeUndefined();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ extra: expect.objectContaining({ action: 'SUBSCRIPTION_ACTIVATED' }) }),
    );
  });
});

describe('AuditService.purgeOld (AUDIT-1)', () => {
  it('deletes entries older than the given retention window', async () => {
    const { service, prisma } = buildService();
    prisma.auditLog.deleteMany.mockImplementation(() => Promise.resolve({ count: 3 }));

    const count = await service.purgeOld(180);

    expect(count).toBe(3);
    const call = prisma.auditLog.deleteMany.mock.calls[0]!;
    const cutoff = call[0].where.createdAt.lt;
    const expectedCutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(5000);
  });

  it('returns 0 when nothing is old enough to purge', async () => {
    const { service } = buildService();
    await expect(service.purgeOld(180)).resolves.toBe(0);
  });
});

describe('AuditService.listForAgency', () => {
  it('filters directly by the denormalized agencyId column, not a join through user', async () => {
    const { service, prisma } = buildService();
    await service.listForAgency('agency-1');
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agencyId: 'agency-1' } }),
    );
  });
});
