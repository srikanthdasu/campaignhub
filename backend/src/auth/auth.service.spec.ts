import { describe, expect, it, vi } from 'vitest';

vi.mock('bcrypt', () => ({
  hash: vi.fn(async () => 'hashed-password'),
  compare: vi.fn(async (plain: string) => plain === 'correct-password'),
}));

import { AuthService } from './auth.service.js';
import { Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

function buildService(overrides: { existingUser?: any } = {}) {
  const audit = { log: vi.fn() };
  const jwt = {
    sign: vi.fn(() => 'signed-token'),
    verify: vi.fn(() => ({ sub: 'user-1', jti: 'jti-1' })),
    decode: vi.fn(() => ({ exp: FUTURE_EXP })),
  };
  const config = {
    get: vi.fn((key: string, fallback?: unknown) => fallback),
    getOrThrow: vi.fn((key: string) => `secret-${key}`),
  };
  const prisma = {
    user: {
      findUnique: vi.fn(() => Promise.resolve(overrides.existingUser ?? null)),
    },
    refreshToken: {
      create: vi.fn(() => Promise.resolve({})),
      findUnique: vi.fn(() => Promise.resolve(null)),
      update: vi.fn(() => Promise.resolve({})),
      updateMany: vi.fn(() => Promise.resolve({})),
    },
    $transaction: vi.fn((fn: any) =>
      fn({
        agency: { create: vi.fn((args: any) => Promise.resolve({ id: 'agency-1', ...args.data })) },
        user: { create: vi.fn((args: any) => Promise.resolve({ id: 'user-1', ...args.data })) },
      }),
    ),
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as any,
    config as any,
    audit as unknown as AuditService,
  );
  return { service, prisma, audit, jwt, config };
}

describe('AuthService.register', () => {
  it('rejects a duplicate email', async () => {
    const { service } = buildService({ existingUser: { id: 'existing' } });
    await expect(
      service.register({ agencyName: 'A', name: 'B', email: 'a@b.com', password: 'password123' }),
    ).rejects.toThrow('An account with this email already exists');
  });

  it('creates a new agency with the registering user as OWNER, and never leaks the password hash', async () => {
    const { service, prisma } = buildService();
    const result = await service.register({
      agencyName: 'Acme',
      name: 'Founder',
      email: 'founder@acme.com',
      password: 'password123',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.user.role).toBe(Role.OWNER);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.accessToken).toBe('signed-token');
  });
});

describe('AuthService.login', () => {
  it('gives an identical error for a nonexistent email as for a wrong password (no user enumeration)', async () => {
    const noUser = buildService({ existingUser: null });
    const wrongPassword = buildService({
      existingUser: { id: 'u1', email: 'a@b.com', passwordHash: 'x', isActive: true },
    });

    let noUserError: unknown;
    let wrongPasswordError: unknown;
    try {
      await noUser.service.login({ email: 'a@b.com', password: 'whatever' });
    } catch (e) {
      noUserError = e;
    }
    try {
      await wrongPassword.service.login({ email: 'a@b.com', password: 'wrong-password' });
    } catch (e) {
      wrongPasswordError = e;
    }

    expect((noUserError as Error).message).toBe('Invalid credentials');
    expect((wrongPasswordError as Error).message).toBe('Invalid credentials');
  });

  it('rejects a deactivated account with the same generic message and logs the reason', async () => {
    const { service, audit } = buildService({
      existingUser: { id: 'u1', email: 'a@b.com', passwordHash: 'x', isActive: false },
    });
    await expect(service.login({ email: 'a@b.com', password: 'whatever' })).rejects.toThrow(
      'Invalid credentials',
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED_INACTIVE' }));
  });

  it('logs in successfully with the correct password and issues a token pair', async () => {
    const { service, prisma } = buildService({
      existingUser: { id: 'u1', email: 'a@b.com', passwordHash: 'x', isActive: true, role: Role.CREATOR, agencyId: 'agency-1' },
    });
    const result = await service.login({ email: 'a@b.com', password: 'correct-password' });
    expect(result.accessToken).toBe('signed-token');
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });
});

describe('AuthService.refresh', () => {
  it('rejects when the presented token does not verify', async () => {
    const { service, jwt } = buildService();
    jwt.verify.mockImplementationOnce(() => {
      throw new Error('bad signature');
    });
    await expect(service.refresh('tampered')).rejects.toThrow('Invalid or expired refresh token');
  });

  it('rejects a token whose stored record was already revoked', async () => {
    const { service, prisma } = buildService();
    prisma.refreshToken.findUnique = vi.fn(() =>
      Promise.resolve({
        id: 'jti-1',
        userId: 'user-1',
        tokenHash: 'irrelevant-since-already-revoked',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100_000),
      }),
    ) as any;
    await expect(service.refresh('some-token')).rejects.toThrow('Invalid or expired refresh token');
  });

  it('rejects a token whose hash does not match the stored hash (reuse/tamper detection)', async () => {
    const { service, prisma } = buildService();
    prisma.refreshToken.findUnique = vi.fn(() =>
      Promise.resolve({
        id: 'jti-1',
        userId: 'user-1',
        tokenHash: 'does-not-match',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      }),
    ) as any;
    await expect(service.refresh('some-token')).rejects.toThrow('Invalid or expired refresh token');
  });

  it('rotates the token on success: revokes the used one and issues a new pair', async () => {
    const { service, prisma } = buildService({
      existingUser: { id: 'user-1', email: 'a@b.com', isActive: true, role: Role.CREATOR, agencyId: 'agency-1' },
    });
    const hashToken = (service as any).hashToken.bind(service);
    prisma.refreshToken.findUnique = vi.fn(() =>
      Promise.resolve({
        id: 'jti-1',
        userId: 'user-1',
        tokenHash: hashToken('some-token'),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      }),
    ) as any;

    const result = await service.refresh('some-token');

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'jti-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.accessToken).toBe('signed-token');
  });

  it('rejects a valid token whose user has since been deactivated', async () => {
    const { service, prisma } = buildService({
      existingUser: { id: 'user-1', email: 'a@b.com', isActive: false },
    });
    const hashToken = (service as any).hashToken.bind(service);
    prisma.refreshToken.findUnique = vi.fn(() =>
      Promise.resolve({
        id: 'jti-1',
        userId: 'user-1',
        tokenHash: hashToken('some-token'),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      }),
    ) as any;
    await expect(service.refresh('some-token')).rejects.toThrow('Account is no longer active');
  });
});

describe('AuthService.logout', () => {
  it('is a no-op when no refresh token is presented', async () => {
    const { service, prisma } = buildService();
    await service.logout(undefined);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('revokes the refresh token by its jti', async () => {
    const { service, prisma, jwt } = buildService();
    jwt.decode.mockReturnValueOnce({ jti: 'jti-1' });
    await service.logout('some-token');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'jti-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
