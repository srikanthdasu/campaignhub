import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard.js';
import { Role } from '../../generated/prisma/client.js';
import type { ExecutionContext } from '@nestjs/common';

function buildContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function buildGuard(requiredRoles: Role[] | undefined) {
  const reflector = { getAllAndOverride: vi.fn(() => requiredRoles) };
  return new RolesGuard(reflector as any);
}

describe('RolesGuard', () => {
  it('allows everyone when the route has no @Roles() requirement', () => {
    const guard = buildGuard(undefined);
    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('rejects a user whose role is not in the required list', () => {
    const guard = buildGuard([Role.OWNER, Role.ADMIN]);
    const user = { sub: 'u1', agencyId: 'agency-1', role: Role.CREATOR };
    expect(() => guard.canActivate(buildContext(user))).toThrow(ForbiddenException);
  });

  it('allows a user whose role is in the required list', () => {
    const guard = buildGuard([Role.OWNER, Role.ADMIN]);
    const user = { sub: 'u1', agencyId: 'agency-1', role: Role.OWNER };
    expect(guard.canActivate(buildContext(user))).toBe(true);
  });

  it('rejects when there is no user at all, even with no required roles listed on this call', () => {
    const guard = buildGuard([Role.OWNER]);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });

  it('SUPER_ADMIN passes regardless of the required roles — not just OWNER/ADMIN routes', () => {
    const guard = buildGuard([Role.CREATOR]); // a role SUPER_ADMIN isn't even a member of
    const user = { sub: 'u1', agencyId: null, role: Role.SUPER_ADMIN };
    expect(guard.canActivate(buildContext(user))).toBe(true);
  });
});
