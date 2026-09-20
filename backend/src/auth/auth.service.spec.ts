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
  const email = { send: vi.fn(() => Promise.resolve()) };
  const jwt = {
    sign: vi.fn(() => 'signed-token'),
    verify: vi.fn(() => ({ sub: 'user-1', jti: 'jti-1' })),
    decode: vi.fn(() => ({ exp: FUTURE_EXP })),
  };
  const config = {
    get: vi.fn((key: string, fallback?: unknown) => fallback),
    getOrThrow: vi.fn((key: string) => `secret-${key}`),
  };
  const txUserCreate = vi.fn((args: any) => Promise.resolve({ id: 'user-1', ...args.data }));
  const txAgencyCreate = vi.fn((args: any) => Promise.resolve({ id: 'agency-1', ...args.data }));
  const prisma = {
    user: {
      findUnique: vi.fn(() => Promise.resolve(overrides.existingUser ?? null)),
      update: vi.fn((args: any) => Promise.resolve({ ...overrides.existingUser, ...args.data })),
    },
    refreshToken: {
      create: vi.fn(() => Promise.resolve({})),
      findUnique: vi.fn(() => Promise.resolve(null)),
      update: vi.fn(() => Promise.resolve({})),
      updateMany: vi.fn(() => Promise.resolve({})),
    },
    $transaction: vi.fn((fn: any) =>
      fn({
        agency: { create: txAgencyCreate },
        user: { create: txUserCreate },
      }),
    ),
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as any,
    config as any,
    audit as unknown as AuditService,
    email as any,
  );
  return { service, prisma, audit, jwt, config, email, txUserCreate };
}

describe('AuthService.register', () => {
  it('rejects a duplicate email', async () => {
    const { service } = buildService({ existingUser: { id: 'existing' } });
    await expect(
      service.register({ agencyName: 'A', name: 'B', email: 'a@b.com', password: 'password123' }),
    ).rejects.toThrow('An account with this email already exists');
  });

  it('creates a new agency with the registering user as OWNER, sends a verification email, and does not auto-login', async () => {
    const { service, prisma, email } = buildService();
    const result = await service.register({
      agencyName: 'Acme',
      name: 'Founder',
      email: 'founder@acme.com',
      password: 'password123',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({ message: 'Check your email to verify your account.' });
    expect(email.send).toHaveBeenCalledWith(
      'founder@acme.com',
      expect.stringContaining('Verify your CampaignHub AI account'),
      expect.stringContaining('verify-email?token='),
    );
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('stores a hashed verification token with an expiry on the new user', async () => {
    const { service, txUserCreate } = buildService();
    await service.register({
      agencyName: 'Acme',
      name: 'Founder',
      email: 'founder@acme.com',
      password: 'password123',
    });

    const createArgs = txUserCreate.mock.calls[0][0];
    expect(createArgs.data.verificationTokenHash).toEqual(expect.any(String));
    expect(createArgs.data.verificationTokenExpiresAt).toBeInstanceOf(Date);
  });
});

describe('AuthService.login', () => {
  it('gives an identical error for a nonexistent email as for a wrong password (no user enumeration)', async () => {
    const noUser = buildService({ existingUser: null });
    const wrongPassword = buildService({
      existingUser: { id: 'u1', email: 'a@b.com', passwordHash: 'x', isActive: true, emailVerifiedAt: new Date() },
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
      existingUser: {
        id: 'u1',
        email: 'a@b.com',
        passwordHash: 'x',
        isActive: true,
        role: Role.CREATOR,
        agencyId: 'agency-1',
        emailVerifiedAt: new Date(),
      },
    });
    const result = await service.login({ email: 'a@b.com', password: 'correct-password' });
    expect(result.accessToken).toBe('signed-token');
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('rejects an unverified account with a distinguishable message and logs LOGIN_FAILED_UNVERIFIED', async () => {
    const { service, audit } = buildService({
      existingUser: { id: 'u1', email: 'a@b.com', passwordHash: 'x', isActive: true, emailVerifiedAt: null },
    });
    await expect(service.login({ email: 'a@b.com', password: 'correct-password' })).rejects.toThrow(
      'Please verify your email before logging in.',
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED_UNVERIFIED' }));
  });

  it('still gives the generic no-enumeration message for a wrong password against an unverified account', async () => {
    const { service, audit } = buildService({
      existingUser: { id: 'u1', email: 'a@b.com', passwordHash: 'x', isActive: true, emailVerifiedAt: null },
    });
    await expect(service.login({ email: 'a@b.com', password: 'wrong-password' })).rejects.toThrow(
      'Invalid credentials',
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED' }));
    expect(audit.log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED_UNVERIFIED' }));
  });
});

describe('AuthService.verifyEmail', () => {
  it('verifies a user with a valid, unexpired token and issues a token pair', async () => {
    const { service, prisma, audit } = buildService();
    const hash = (service as any).hashToken('raw-token');
    prisma.user.findUnique = vi.fn(() =>
      Promise.resolve({
        id: 'u1',
        email: 'a@b.com',
        role: Role.OWNER,
        agencyId: 'agency-1',
        verificationTokenHash: hash,
        verificationTokenExpiresAt: new Date(Date.now() + 100_000),
      }),
    ) as any;

    const result = await service.verifyEmail('raw-token');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { emailVerifiedAt: expect.any(Date), verificationTokenHash: null, verificationTokenExpiresAt: null },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'EMAIL_VERIFIED' }));
    expect(result.accessToken).toBe('signed-token');
  });

  it('rejects an unknown token', async () => {
    const { service, prisma } = buildService();
    prisma.user.findUnique = vi.fn(() => Promise.resolve(null)) as any;
    await expect(service.verifyEmail('bogus-token')).rejects.toThrow(
      'This verification link is invalid or has expired.',
    );
  });

  it('rejects an expired token', async () => {
    const { service, prisma } = buildService();
    const hash = (service as any).hashToken('raw-token');
    prisma.user.findUnique = vi.fn(() =>
      Promise.resolve({
        id: 'u1',
        verificationTokenHash: hash,
        verificationTokenExpiresAt: new Date(Date.now() - 1000),
      }),
    ) as any;
    await expect(service.verifyEmail('raw-token')).rejects.toThrow(
      'This verification link is invalid or has expired.',
    );
  });
});

describe('AuthService.resendVerification', () => {
  it('returns the generic message and sends nothing for a nonexistent email', async () => {
    const { service, email } = buildService({ existingUser: null });
    const result = await service.resendVerification('nobody@nowhere.com');
    expect(email.send).not.toHaveBeenCalled();
    expect(result.message).toMatch(/if an account with that email exists/i);
  });

  it('returns the same generic message and sends nothing for an already-verified email (no enumeration)', async () => {
    const { service, email } = buildService({
      existingUser: { id: 'u1', email: 'a@b.com', emailVerifiedAt: new Date() },
    });
    const result = await service.resendVerification('a@b.com');
    expect(email.send).not.toHaveBeenCalled();
    expect(result.message).toMatch(/if an account with that email exists/i);
  });

  it('generates a new token and sends the email for a real unverified user', async () => {
    const { service, prisma, email } = buildService({
      existingUser: { id: 'u1', email: 'a@b.com', name: 'A', emailVerifiedAt: null },
    });
    await service.resendVerification('a@b.com');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { verificationTokenHash: expect.any(String), verificationTokenExpiresAt: expect.any(Date) },
    });
    expect(email.send).toHaveBeenCalledTimes(1);
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
