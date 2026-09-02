import { describe, expect, it, vi } from 'vitest';
import { SocialAccountsService } from './social-accounts.service.js';
import { decryptToken } from './token-crypto.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { ConfigService } from '@nestjs/config';

const ENCRYPTION_KEY = 'test-only-encryption-key';

function buildService(overrides: { account?: any } = {}) {
  const account = overrides.account ?? { id: 'acct-1', clientId: 'client-1', platform: 'INSTAGRAM', label: 'Main' };
  const audit = { log: vi.fn() };
  const prisma = {
    socialAccount: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'acct-1', ...args.data })),
      upsert: vi.fn((args: any) => Promise.resolve({ id: 'acct-1', ...args.create })),
      findMany: vi.fn(() => Promise.resolve([])),
      findUnique: vi.fn(() => Promise.resolve(account)),
      delete: vi.fn(() => Promise.resolve({})),
    },
  };
  const config = { getOrThrow: vi.fn(() => ENCRYPTION_KEY) };
  const service = new SocialAccountsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    config as unknown as ConfigService,
  );
  return { service, prisma, audit, account };
}

describe('SocialAccountsService', () => {
  it('rejects removing an account that belongs to a different client', async () => {
    const { service, prisma } = buildService({ account: { id: 'acct-1', clientId: 'other-client' } });
    await expect(service.remove('client-1', 'acct-1', 'actor-1')).rejects.toThrow(
      'Social account not found for this client',
    );
    expect(prisma.socialAccount.delete).not.toHaveBeenCalled();
  });

  it('never selects token columns when creating or listing', async () => {
    const { service, prisma } = buildService();
    await service.create('client-1', 'actor-1', {
      platform: 'INSTAGRAM',
      label: 'Main',
      externalAccountId: 'ext-1',
    } as any);
    await service.list('client-1');

    for (const call of [...prisma.socialAccount.create.mock.calls, ...prisma.socialAccount.findMany.mock.calls]) {
      const select = call[0].select;
      expect(select.accessTokenEncrypted).toBeUndefined();
      expect(select.refreshTokenEncrypted).toBeUndefined();
    }
  });
});

describe('SocialAccountsService.createFromOAuth', () => {
  it('encrypts the access token before it ever reaches Prisma', async () => {
    const { service, prisma } = buildService();
    await service.createFromOAuth('client-1', 'actor-1', 'FACEBOOK' as any, 'Aurelia Skincare', 'fb-123', 'raw-access-token');

    const stored = prisma.socialAccount.upsert.mock.calls[0][0].create.accessTokenEncrypted;
    expect(stored).not.toBe('raw-access-token');
    expect(decryptToken(stored, ENCRYPTION_KEY)).toBe('raw-access-token');
  });

  it('never selects token columns back out', async () => {
    const { service, prisma } = buildService();
    await service.createFromOAuth('client-1', 'actor-1', 'FACEBOOK' as any, 'Aurelia Skincare', 'fb-123', 'raw-access-token');

    const select = prisma.socialAccount.upsert.mock.calls[0][0].select;
    expect(select.accessTokenEncrypted).toBeUndefined();
    expect(select.refreshTokenEncrypted).toBeUndefined();
  });
});
