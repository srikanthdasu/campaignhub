import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service.js';
import { Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { CreateMemberDto } from './dto/create-member.dto.js';

function buildService(overrides: { existingUser?: any; ownerCount?: number } = {}) {
  const audit = { log: vi.fn() };
  const prisma = {
    user: {
      findUnique: vi.fn(() => Promise.resolve(overrides.existingUser ?? null)),
      create: vi.fn((args: any) => Promise.resolve({ id: 'new-user', ...args.data })),
      update: vi.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      count: vi.fn(() => Promise.resolve(overrides.ownerCount ?? 2)),
    },
    client: { count: vi.fn(() => Promise.resolve(0)) },
  };
  const service = new UsersService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, audit };
}

function makeDto(overrides: Partial<CreateMemberDto> = {}): CreateMemberDto {
  return {
    email: 'new@agency.com',
    name: 'New Member',
    password: 'password123',
    role: Role.CREATOR,
    ...overrides,
  };
}

describe('UsersService.createMember', () => {
  it('lets an ADMIN create a non-Owner member', async () => {
    const { service, prisma } = buildService();
    await service.createMember('agency-1', 'actor-1', Role.ADMIN, makeDto({ role: Role.MANAGER }));
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('blocks an ADMIN from creating a new Owner (privilege escalation)', async () => {
    const { service, prisma } = buildService();
    await expect(
      service.createMember('agency-1', 'actor-1', Role.ADMIN, makeDto({ role: Role.OWNER })),
    ).rejects.toThrow('Only an Owner can create another Owner');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('allows an OWNER to create a new Owner', async () => {
    const { service, prisma } = buildService();
    await service.createMember('agency-1', 'actor-1', Role.OWNER, makeDto({ role: Role.OWNER }));
    expect(prisma.user.create).toHaveBeenCalled();
  });
});

describe('UsersService.updateRole', () => {
  it('lets an ADMIN promote a member to a non-Owner role', async () => {
    const { service, prisma } = buildService({ existingUser: { id: 'u1', agencyId: 'agency-1', role: Role.CREATOR } });
    await service.updateRole('agency-1', 'actor-1', Role.ADMIN, 'u1', Role.MANAGER);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('blocks an ADMIN from promoting a member to Owner (privilege escalation)', async () => {
    const { service, prisma } = buildService({ existingUser: { id: 'u1', agencyId: 'agency-1', role: Role.CREATOR } });
    await expect(service.updateRole('agency-1', 'actor-1', Role.ADMIN, 'u1', Role.OWNER)).rejects.toThrow(
      'Only an Owner can promote a member to Owner',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('blocks an ADMIN from self-promoting to Owner', async () => {
    const { service, prisma } = buildService({ existingUser: { id: 'actor-1', agencyId: 'agency-1', role: Role.ADMIN } });
    await expect(service.updateRole('agency-1', 'actor-1', Role.ADMIN, 'actor-1', Role.OWNER)).rejects.toThrow(
      'Only an Owner can promote a member to Owner',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows an OWNER to promote a member to Owner', async () => {
    const { service, prisma } = buildService({ existingUser: { id: 'u1', agencyId: 'agency-1', role: Role.CREATOR } });
    await service.updateRole('agency-1', 'actor-1', Role.OWNER, 'u1', Role.OWNER);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('blocks demoting the last remaining Owner', async () => {
    const { service, prisma } = buildService({
      existingUser: { id: 'u1', agencyId: 'agency-1', role: Role.OWNER },
      ownerCount: 1,
    });
    await expect(service.updateRole('agency-1', 'actor-1', Role.OWNER, 'u1', Role.ADMIN)).rejects.toThrow(
      'must always have at least one Owner',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a target user from a different agency', async () => {
    const { service } = buildService({ existingUser: { id: 'u1', agencyId: 'agency-2', role: Role.CREATOR } });
    await expect(service.updateRole('agency-1', 'actor-1', Role.OWNER, 'u1', Role.MANAGER)).rejects.toThrow(
      'User not found in this agency',
    );
  });
});
