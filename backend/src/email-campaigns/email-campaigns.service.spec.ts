import { describe, expect, it, vi } from 'vitest';
import { EmailCampaignsService } from './email-campaigns.service.js';
import { EmailCampaignStatus, EmailRecipientStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { EmailService } from '../notifications/email.service.js';
import type { ConfigService } from '@nestjs/config';

function buildService(overrides: { campaign?: any; recipients?: any[]; unsubscribes?: any[] } = {}) {
  const campaign = overrides.campaign ?? {
    id: 'campaign-1',
    clientId: 'client-1',
    status: EmailCampaignStatus.DRAFT,
    subject: 'Hello',
    bodyTemplate: 'Hi {{name}}, welcome!',
  };
  const audit = { log: vi.fn() };
  const email = { send: vi.fn(() => Promise.resolve(true)) };
  const config = {
    get: vi.fn((key: string) => (key === 'EMAIL_CAMPAIGN_BATCH_SIZE' ? '20' : undefined)),
  };
  const prisma = {
    emailCampaign: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'campaign-1', ...args.data })),
      findUnique: vi.fn(() => Promise.resolve(campaign)),
      findMany: vi.fn(() => Promise.resolve([campaign])),
      update: vi.fn((args: any) => Promise.resolve({ ...campaign, ...args.data })),
      delete: vi.fn(() => Promise.resolve({})),
    },
    emailRecipient: {
      createMany: vi.fn(() => Promise.resolve({ count: 0 })),
      findUnique: vi.fn(() => Promise.resolve(overrides.recipients?.[0] ?? null)),
      findMany: vi.fn(() => Promise.resolve(overrides.recipients ?? [])),
      update: vi.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      delete: vi.fn(() => Promise.resolve({})),
      count: vi.fn(() => Promise.resolve(overrides.recipients?.length ?? 0)),
    },
    emailUnsubscribe: {
      findMany: vi.fn(() => Promise.resolve(overrides.unsubscribes ?? [])),
      findUnique: vi.fn(() => Promise.resolve(null)),
      upsert: vi.fn(() => Promise.resolve({})),
    },
  };
  const service = new EmailCampaignsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    email as unknown as EmailService,
    config as unknown as ConfigService,
  );
  return { service, prisma, audit, email, config, campaign };
}

describe('EmailCampaignsService — tenant scoping', () => {
  it('rejects a campaign belonging to a different client', async () => {
    const { service } = buildService({ campaign: { id: 'campaign-1', clientId: 'other-client', status: 'DRAFT' } });
    await expect(service.getOne('client-1', 'campaign-1')).rejects.toThrow(
      'Email campaign not found for this client',
    );
  });
});

describe('EmailCampaignsService — DRAFT-only guards', () => {
  it('rejects editing a campaign that is no longer DRAFT', async () => {
    const { service } = buildService({ campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.SENT } });
    await expect(service.update('client-1', 'campaign-1', 'actor-1', { name: 'x' } as any)).rejects.toThrow(
      'Only draft campaigns can be edited',
    );
  });

  it('rejects deleting a campaign that is no longer DRAFT', async () => {
    const { service } = buildService({ campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.QUEUED } });
    await expect(service.remove('client-1', 'campaign-1', 'actor-1')).rejects.toThrow(
      'Only draft campaigns can be deleted',
    );
  });

  it('rejects importing recipients into a non-DRAFT campaign', async () => {
    const { service } = buildService({ campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.SENDING } });
    await expect(
      service.bulkImportRecipients('client-1', 'campaign-1', 'actor-1', {
        recipients: [{ name: 'A', email: 'a@b.com' }],
      }),
    ).rejects.toThrow('Recipients can only be added while the campaign is still a draft');
  });
});

describe('EmailCampaignsService.bulkImportRecipients', () => {
  it('dedupes recipients within the same payload (case-insensitive)', async () => {
    const { service, prisma } = buildService();
    const result = await service.bulkImportRecipients('client-1', 'campaign-1', 'actor-1', {
      recipients: [
        { name: 'A', email: 'same@example.com' },
        { name: 'A dup', email: 'SAME@example.com' },
        { name: 'B', email: 'b@example.com' },
      ],
    });
    expect(result.imported).toBe(2);
    const created = (prisma.emailRecipient.createMany as any).mock.calls[0][0].data;
    expect(created).toHaveLength(2);
  });

  it('marks an already-unsubscribed email as UNSUBSCRIBED instead of PENDING, not silently dropped', async () => {
    const { service, prisma } = buildService({ unsubscribes: [{ email: 'blocked@example.com' }] });
    const result = await service.bulkImportRecipients('client-1', 'campaign-1', 'actor-1', {
      recipients: [
        { name: 'Blocked', email: 'blocked@example.com' },
        { name: 'Fine', email: 'fine@example.com' },
      ],
    });
    expect(result.imported).toBe(2);
    expect(result.skippedAsUnsubscribed).toBe(1);
    const created = (prisma.emailRecipient.createMany as any).mock.calls[0][0].data;
    expect(created.find((r: any) => r.email === 'blocked@example.com').status).toBe(EmailRecipientStatus.UNSUBSCRIBED);
    expect(created.find((r: any) => r.email === 'fine@example.com').status).toBe(EmailRecipientStatus.PENDING);
  });
});

describe('EmailCampaignsService.send', () => {
  it('rejects sending with zero pending recipients (empty or all-unsubscribed list)', async () => {
    const { service, prisma } = buildService();
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(0)) as any;
    await expect(service.send('client-1', 'campaign-1', 'actor-1')).rejects.toThrow(
      'Add at least one recipient',
    );
  });

  it('queues a campaign that has at least one pending recipient', async () => {
    const { service, prisma } = buildService();
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(3)) as any;
    const result = await service.send('client-1', 'campaign-1', 'actor-1');
    expect(result.status).toBe(EmailCampaignStatus.QUEUED);
    expect(prisma.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: EmailCampaignStatus.QUEUED }) }),
    );
  });

  it('rejects sending a campaign that is already queued/sent', async () => {
    const { service } = buildService({ campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.SENT } });
    await expect(service.send('client-1', 'campaign-1', 'actor-1')).rejects.toThrow(
      'already been queued or sent',
    );
  });
});

describe('EmailCampaignsService.processQueuedCampaigns', () => {
  it('sends to PENDING recipients, merges the name, and marks them SENT', async () => {
    const recipient = { id: 'r1', campaignId: 'campaign-1', name: 'Priya', email: 'priya@example.com', status: EmailRecipientStatus.PENDING };
    const { service, prisma, email } = buildService({
      campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.QUEUED, subject: 'Hi', bodyTemplate: 'Hello {{name}}!' },
      recipients: [recipient],
    });
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(0)) as any; // none pending after this batch

    const sent = await service.processQueuedCampaigns();

    expect(sent).toBe(1);
    expect(email.send).toHaveBeenCalledWith('priya@example.com', 'Hi', expect.stringContaining('Hello Priya!'));
    expect(email.send).toHaveBeenCalledWith('priya@example.com', 'Hi', expect.stringContaining('Unsubscribe:'));
    expect(prisma.emailRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1' }, data: expect.objectContaining({ status: EmailRecipientStatus.SENT }) }),
    );
  });

  it('marks a failed delivery as FAILED, not SENT', async () => {
    const recipient = { id: 'r1', campaignId: 'campaign-1', name: 'A', email: 'a@example.com', status: EmailRecipientStatus.PENDING };
    const { service, prisma, email } = buildService({
      campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.QUEUED, subject: 'Hi', bodyTemplate: 'x' },
      recipients: [recipient],
    });
    email.send = vi.fn(() => Promise.resolve(false));
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(0)) as any;

    const sent = await service.processQueuedCampaigns();

    expect(sent).toBe(0);
    expect(prisma.emailRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1' }, data: expect.objectContaining({ status: EmailRecipientStatus.FAILED }) }),
    );
  });

  it('flips the campaign to SENT once no PENDING recipients remain', async () => {
    const { service, prisma } = buildService({
      campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.SENDING, subject: 'Hi', bodyTemplate: 'x' },
      recipients: [],
    });
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(0)) as any;

    await service.processQueuedCampaigns();

    expect(prisma.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: EmailCampaignStatus.SENT }) }),
    );
  });
});

describe('EmailCampaignsService — unsubscribe (public)', () => {
  it('GET-equivalent lookup never mutates state', async () => {
    const recipient = {
      id: 'r1',
      email: 'a@example.com',
      status: EmailRecipientStatus.SENT,
      campaign: { clientId: 'client-1', client: { name: 'Acme' } },
    };
    const { service, prisma } = buildService({ recipients: [recipient] });
    prisma.emailRecipient.findUnique = vi.fn(() => Promise.resolve(recipient)) as any;

    await service.findByUnsubscribeToken('a'.repeat(64));

    expect(prisma.emailRecipient.update).not.toHaveBeenCalled();
    expect(prisma.emailUnsubscribe.upsert).not.toHaveBeenCalled();
  });

  it('POST confirm creates the suppression row and marks the recipient UNSUBSCRIBED', async () => {
    const recipient = {
      id: 'r1',
      email: 'a@example.com',
      status: EmailRecipientStatus.SENT,
      campaign: { clientId: 'client-1', client: { name: 'Acme' } },
    };
    const { service, prisma } = buildService();
    prisma.emailRecipient.findUnique = vi.fn(() => Promise.resolve(recipient)) as any;

    const result = await service.confirmUnsubscribe('a'.repeat(64));

    expect(result).toEqual({ email: 'a@example.com', clientName: 'Acme' });
    expect(prisma.emailUnsubscribe.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId_email: { clientId: 'client-1', email: 'a@example.com' } } }),
    );
    expect(prisma.emailRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: EmailRecipientStatus.UNSUBSCRIBED } }),
    );
  });

  it('confirm is idempotent — already-unsubscribed recipient does not error or double-update', async () => {
    const recipient = {
      id: 'r1',
      email: 'a@example.com',
      status: EmailRecipientStatus.UNSUBSCRIBED,
      campaign: { clientId: 'client-1', client: { name: 'Acme' } },
    };
    const { service, prisma } = buildService();
    prisma.emailRecipient.findUnique = vi.fn(() => Promise.resolve(recipient)) as any;

    await expect(service.confirmUnsubscribe('a'.repeat(64))).resolves.toEqual({
      email: 'a@example.com',
      clientName: 'Acme',
    });
    expect(prisma.emailRecipient.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown token', async () => {
    const { service, prisma } = buildService();
    prisma.emailRecipient.findUnique = vi.fn(() => Promise.resolve(null)) as any;
    await expect(service.findByUnsubscribeToken('bogus'.repeat(10))).rejects.toThrow(
      'This unsubscribe link is invalid.',
    );
  });
});
