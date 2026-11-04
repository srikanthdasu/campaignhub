import { describe, expect, it, vi } from 'vitest';
import { ClientEmailSenderService } from './client-email-sender.service.js';
import { ClientEmailSenderVerificationStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { ConfigService } from '@nestjs/config';

function buildService(overrides: { sender?: any; brevoApiKey?: string } = {}) {
  const audit = { log: vi.fn() };
  const config = {
    get: vi.fn((key: string) => (key === 'BREVO_API_KEY' ? overrides.brevoApiKey : undefined)),
  };
  const prisma = {
    clientEmailSender: {
      findUnique: vi.fn(() => Promise.resolve(overrides.sender ?? null)),
      upsert: vi.fn((args: any) => Promise.resolve({ id: 'sender-1', ...args.create, ...args.update })),
      update: vi.fn((args: any) => Promise.resolve({ ...overrides.sender, ...args.data })),
    },
    emailRecipient: {
      count: vi.fn(() => Promise.resolve(0)),
    },
  };
  const service = new ClientEmailSenderService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    config as unknown as ConfigService,
  );
  return { service, prisma, audit, config };
}

describe('ClientEmailSenderService.resolveSenderForSend', () => {
  it('returns null when no sender is configured', async () => {
    const { service } = buildService();
    await expect(service.resolveSenderForSend('client-1')).resolves.toBeNull();
  });

  it('returns null when a sender exists but is not yet VERIFIED', async () => {
    const { service } = buildService({
      sender: { senderName: 'Upshift', senderEmail: 'info@upshiftservices.com', verificationStatus: ClientEmailSenderVerificationStatus.PENDING },
    });
    await expect(service.resolveSenderForSend('client-1')).resolves.toBeNull();
  });

  it('returns the sender identity once VERIFIED', async () => {
    const { service } = buildService({
      sender: { senderName: 'Upshift', senderEmail: 'info@upshiftservices.com', verificationStatus: ClientEmailSenderVerificationStatus.VERIFIED },
    });
    await expect(service.resolveSenderForSend('client-1')).resolves.toEqual({
      name: 'Upshift',
      email: 'info@upshiftservices.com',
    });
  });
});

describe('ClientEmailSenderService.checkQuota', () => {
  it('is a no-op when the client has no sender configured', async () => {
    const { service } = buildService();
    await expect(service.checkQuota('client-1', 100)).resolves.toBeUndefined();
  });

  it('is a no-op when the sender has no limits set', async () => {
    const { service } = buildService({ sender: { dailySendLimit: null, monthlySendLimit: null } });
    await expect(service.checkQuota('client-1', 100)).resolves.toBeUndefined();
  });

  it('rejects when the daily limit would be exceeded', async () => {
    const { service, prisma } = buildService({ sender: { dailySendLimit: 50, monthlySendLimit: null } });
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(40)) as any;
    await expect(service.checkQuota('client-1', 20)).rejects.toThrow('daily send limit');
  });

  it('passes when sending would stay within the daily limit', async () => {
    const { service, prisma } = buildService({ sender: { dailySendLimit: 50, monthlySendLimit: null } });
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(10)) as any;
    await expect(service.checkQuota('client-1', 20)).resolves.toBeUndefined();
  });

  it('rejects when the monthly limit would be exceeded, even if under the daily one', async () => {
    const { service, prisma } = buildService({ sender: { dailySendLimit: 1000, monthlySendLimit: 100 } });
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(90)) as any;
    await expect(service.checkQuota('client-1', 20)).rejects.toThrow('monthly send limit');
  });
});

describe('ClientEmailSenderService.upsert', () => {
  it('saves the sender even when BREVO_API_KEY is not configured, with no DNS records returned', async () => {
    const { service, prisma } = buildService();
    const result = await service.upsert('client-1', 'actor-1', {
      senderName: 'Upshift Services',
      senderEmail: 'info@upshiftservices.com',
    });
    expect(result.dnsRecords).toBeNull();
    expect(prisma.clientEmailSender.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'client-1' },
        create: expect.objectContaining({ senderEmail: 'info@upshiftservices.com', domain: 'upshiftservices.com' }),
      }),
    );
  });

  it('resets verification to PENDING when the domain changes on an already-verified sender', async () => {
    const { service, prisma } = buildService({
      sender: { domain: 'old-domain.com', verificationStatus: ClientEmailSenderVerificationStatus.VERIFIED },
    });
    await service.upsert('client-1', 'actor-1', { senderName: 'New', senderEmail: 'new@new-domain.com' });
    expect(prisma.clientEmailSender.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ verificationStatus: ClientEmailSenderVerificationStatus.PENDING, verifiedAt: null }),
      }),
    );
  });

  it('does not reset verification when only the send limits change, not the domain', async () => {
    const { service, prisma } = buildService({
      sender: { domain: 'upshiftservices.com', senderEmail: 'info@upshiftservices.com', verificationStatus: ClientEmailSenderVerificationStatus.VERIFIED },
    });
    await service.upsert('client-1', 'actor-1', {
      senderName: 'Upshift Services',
      senderEmail: 'info@upshiftservices.com',
      dailySendLimit: 100,
    });
    const updateArg = (prisma.clientEmailSender.upsert as any).mock.calls[0][0].update;
    expect(updateArg).not.toHaveProperty('verificationStatus');
  });

  it('rejects a sender email with no domain part', async () => {
    const { service } = buildService();
    await expect(
      service.upsert('client-1', 'actor-1', { senderName: 'Bad', senderEmail: 'not-an-email' }),
    ).rejects.toThrow('valid address with a domain');
  });
});
