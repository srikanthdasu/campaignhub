import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { ExecutionContext } from '@nestjs/common';

function buildContext(): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function buildGuard(isPublic: boolean | undefined) {
  const reflector = { getAllAndOverride: vi.fn(() => isPublic) };
  return new JwtAuthGuard(reflector as any);
}

// JwtAuthGuard's own logic is just the @Public() bypass check — the actual token verification is
// inherited from AuthGuard('jwt') (Passport), so these tests spy on that inherited canActivate
// rather than re-testing Passport itself. Object.getPrototypeOf(JwtAuthGuard.prototype) reliably
// gets the real parent class JwtAuthGuard extends — calling AuthGuard('jwt') again here would
// return a different, unrelated mixin class and the spy would never fire.
const parentPrototype = Object.getPrototypeOf(JwtAuthGuard.prototype);

describe('JwtAuthGuard', () => {
  it('bypasses authentication entirely for a route marked @Public()', () => {
    const guard = buildGuard(true);
    const spy = vi.spyOn(parentPrototype, 'canActivate');
    expect(guard.canActivate(buildContext())).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('delegates to the underlying passport JWT check for a route with no @Public() marker', () => {
    const context = buildContext();
    const spy = vi.spyOn(parentPrototype, 'canActivate').mockReturnValue(true);
    const guard = buildGuard(false);
    expect(guard.canActivate(context)).toBe(true);
    expect(spy).toHaveBeenCalledWith(context);
    spy.mockRestore();
  });

  it('propagates rejection from the underlying passport strategy when no valid token is present', () => {
    const spy = vi.spyOn(parentPrototype, 'canActivate').mockImplementation(() => {
      throw new UnauthorizedException();
    });
    const guard = buildGuard(undefined);
    expect(() => guard.canActivate(buildContext())).toThrow(UnauthorizedException);
    spy.mockRestore();
  });
});
