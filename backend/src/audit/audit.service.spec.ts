import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function buildService(overrides: { user?: { agencyId: string } | null } = {}) {
  const prisma = {
    auditLog: {
      create: vi.fn(() => Promise.resolve({})),
      findMany: vi.fn(() => Promise.resolve([])),
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
