import { describe, expect, it, vi } from 'vitest';

vi.mock('bcrypt', () => ({
  hash: vi.fn(async () => 'hashed-password'),
  compare: vi.fn(async (plain: string) => plain === 'correct-password'),
}));

import { UsersService } from './users.service.js';
import { Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateMemberDto } from './dto/create-member.dto.js';

function buildService(
  overrides: { existingUser?: any; ownerCount?: number; agency?: any; actor?: any; targetAdmins?: any[] } = {},
) {
  const audit = { log: vi.fn() };
  const notifications = { create: vi.fn(), createMany: vi.fn() };
  const prisma = {
    user: {
      findUnique: vi.fn(() => Promise.resolve(overrides.existingUser ?? null)),
      findUniqueOrThrow: vi.fn(() =>
        Promise.resolve(overrides.actor ?? { id: 'super-admin-1', name: 'Super Admin', passwordHash: 'hash' }),
      ),
      findMany: vi.fn(() => Promise.resolve(overrides.targetAdmins ?? [])),
      create: vi.fn((args: any) => Promise.resolve({ id: 'new-user', ...args.data })),
      update: vi.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      count: vi.fn(() => Promise.resolve(overrides.ownerCount ?? 2)),
    },
    client: { count: vi.fn(() => Promise.resolve(0)) },
    agency: {
      findUnique: vi.fn(() =>
        Promise.resolve('agency' in overrides ? overrides.agency : { id: 'agency-2', name: 'Target Agency' }),
      ),
    },
  };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, audit, notifications };
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

  it('rejects SUPER_ADMIN as an assignable role, even for an Owner actor', async () => {
    const { service, prisma } = buildService();
    await expect(
      service.createMember('agency-1', 'actor-1', Role.OWNER, makeDto({ role: Role.SUPER_ADMIN })),
    ).rejects.toThrow('This role cannot be assigned through the app');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('allows a SUPER_ADMIN actor to create a new Owner', async () => {
    const { service, prisma } = buildService();
    await service.createMember('agency-1', 'actor-1', Role.SUPER_ADMIN, makeDto({ role: Role.OWNER }));
    expect(prisma.user.create).toHaveBeenCalled();
  });
});

describe('UsersService.updateRole', () => {
  it('lets an ADMIN promote a member to a non-Owner role', async () => {
    const { service, prisma } = buildService({ existingUser: { id: 'u1', agencyId: 'agency-1', role: Role.CREATOR } });
    await service.updateRole('agency-1', 'actor-1', Role.ADMIN, 'u1', Role.MANAGER);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('notifies the target user their role changed (NOTIF-1)', async () => {
    const { service, notifications } = buildService({ existingUser: { id: 'u1', agencyId: 'agency-1', role: Role.CREATOR } });
    await service.updateRole('agency-1', 'actor-1', Role.ADMIN, 'u1', Role.MANAGER);
    expect(notifications.create).toHaveBeenCalledWith('u1', expect.stringContaining('MANAGER'), expect.any(String));
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

  it('rejects promoting anyone to SUPER_ADMIN, even by an Owner', async () => {
    const { service, prisma } = buildService({ existingUser: { id: 'u1', agencyId: 'agency-1', role: Role.CREATOR } });
    await expect(service.updateRole('agency-1', 'actor-1', Role.OWNER, 'u1', Role.SUPER_ADMIN)).rejects.toThrow(
      'This role cannot be assigned through the app',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('UsersService.setActive', () => {
  it('notifies the target user when deactivated (NOTIF-1)', async () => {
    const { service, notifications } = buildService({ existingUser: { id: 'u1', agencyId: 'agency-1', role: Role.CREATOR } });
    await service.setActive('agency-1', 'actor-1', 'u1', false);
    expect(notifications.create).toHaveBeenCalledWith('u1', expect.stringContaining('deactivated'), expect.any(String));
  });

  it('does not notify on reactivation', async () => {
    const { service, notifications } = buildService({ existingUser: { id: 'u1', agencyId: 'agency-1', role: Role.CREATOR } });
    await service.setActive('agency-1', 'actor-1', 'u1', true);
    expect(notifications.create).not.toHaveBeenCalled();
  });
});

describe('UsersService.actAsAgency', () => {
  it('switches the actor into the target agency and logs it', async () => {
    const { service, prisma, audit } = buildService({ agency: { id: 'agency-2', name: 'Target Agency' } });
    const result = await service.actAsAgency('super-admin-1', 'agency-1', 'agency-2', 'correct-password');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'super-admin-1' }, data: { agencyId: 'agency-2' } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'super-admin-1',
        agencyId: 'agency-2',
        action: 'SUPER_ADMIN_SWITCHED_AGENCY',
        metadata: { from: 'agency-1', to: 'agency-2', agencyName: 'Target Agency' },
      }),
    );
    expect(result.agencyId).toBe('agency-2');
  });

  it('rejects switching into an agency that does not exist', async () => {
    const { service, prisma } = buildService({ agency: null });
    await expect(
      service.actAsAgency('super-admin-1', null, 'ghost-agency', 'correct-password'),
    ).rejects.toThrow('Agency not found');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  // AUTH-3: step-up auth — the JWT alone (already proven by RolesGuard) isn't enough; the
  // password must be re-confirmed before the switch is allowed to happen at all.
  it('rejects the switch when the current password is wrong, without touching the target agency', async () => {
    const { service, prisma, audit } = buildService({ agency: { id: 'agency-2', name: 'Target Agency' } });

    await expect(
      service.actAsAgency('super-admin-1', 'agency-1', 'agency-2', 'wrong-password'),
    ).rejects.toThrow('Current password is incorrect');

    expect(prisma.agency.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SUPER_ADMIN_SWITCH_AGENCY_DENIED',
        metadata: expect.objectContaining({ reason: 'incorrect_password' }),
      }),
    );
  });

  // AUTH-3: active alerting — the agency being stepped into should find out in real time, not
  // only if someone happens to go looking at the audit log.
  it('notifies the target agency’s admins that a platform administrator accessed their account', async () => {
    const { service, notifications } = buildService({
      agency: { id: 'agency-2', name: 'Target Agency' },
      actor: { id: 'super-admin-1', name: 'Sri', passwordHash: 'hash' },
      targetAdmins: [{ id: 'owner-1' }, { id: 'admin-1' }],
    });

    await service.actAsAgency('super-admin-1', 'agency-1', 'agency-2', 'correct-password');

    expect(notifications.createMany).toHaveBeenCalledWith(
      ['owner-1', 'admin-1'],
      expect.stringContaining('Sri'),
      '/admin/audit-log',
    );
  });

  it('does not try to notify anyone when the target agency has no active OWNER/ADMIN', async () => {
    const { service, notifications } = buildService({
      agency: { id: 'agency-2', name: 'Target Agency' },
      targetAdmins: [],
    });

    await service.actAsAgency('super-admin-1', 'agency-1', 'agency-2', 'correct-password');

    expect(notifications.createMany).not.toHaveBeenCalled();
  });
});
