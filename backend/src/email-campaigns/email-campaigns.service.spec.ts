import { describe, expect, it, vi } from 'vitest';
import { EmailCampaignsService } from './email-campaigns.service.js';
import { EmailCampaignStatus, EmailRecipientStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { EmailService } from '../notifications/email.service.js';
import type { ConfigService } from '@nestjs/config';
import type { NotificationsService } from '../notifications/notifications.service.js';

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
      // Default: the atomic PENDING -> SENT claim always succeeds (count: 1) — tests that need to
      // simulate a losing claimant (an overlapping run that already took the row) override this.
      updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      delete: vi.fn(() => Promise.resolve({})),
      count: vi.fn(() => Promise.resolve(overrides.recipients?.length ?? 0)),
    },
    emailUnsubscribe: {
      findMany: vi.fn(() => Promise.resolve(overrides.unsubscribes ?? [])),
      findUnique: vi.fn(() => Promise.resolve(null)),
      upsert: vi.fn(() => Promise.resolve({})),
    },
    user: {
      findMany: vi.fn(() => Promise.resolve([{ id: 'admin-1' }, { id: 'admin-2' }])),
    },
    client: {
      findUnique: vi.fn(() => Promise.resolve({ agencyId: 'agency-1', name: 'Acme Client' })),
    },
  };
  const notifications = { create: vi.fn(), createMany: vi.fn() };
  const service = new EmailCampaignsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    email as unknown as EmailService,
    config as unknown as ConfigService,
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, audit, email, config, campaign, notifications };
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

describe('EmailCampaignsService.requestSend / approveSend / rejectSend', () => {
  it('rejects a send request with zero pending recipients', async () => {
    const { service, prisma } = buildService();
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(0)) as any;
    await expect(service.requestSend('client-1', 'campaign-1', 'actor-1')).rejects.toThrow(
      'Add at least one recipient',
    );
  });

  it('moves a DRAFT campaign to PENDING_APPROVAL, stamps the requester, and notifies agency admins', async () => {
    const { service, prisma, notifications } = buildService();
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(3)) as any;

    const result = await service.requestSend('client-1', 'campaign-1', 'client-user-1');

    expect(result.status).toBe(EmailCampaignStatus.PENDING_APPROVAL);
    expect(prisma.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmailCampaignStatus.PENDING_APPROVAL,
          requestedById: 'client-user-1',
          rejectionReason: null,
        }),
      }),
    );
    expect(notifications.createMany).toHaveBeenCalledWith(
      ['admin-1', 'admin-2'],
      expect.stringContaining('Acme Client'),
      '/email-campaigns',
    );
  });

  it('rejects requesting a send for a campaign that is not DRAFT', async () => {
    const { service } = buildService({ campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.QUEUED } });
    await expect(service.requestSend('client-1', 'campaign-1', 'actor-1')).rejects.toThrow(
      'already been queued or sent',
    );
  });

  it('approves a PENDING_APPROVAL campaign into QUEUED, stamps the approver, and notifies the requester', async () => {
    const { service, prisma, notifications } = buildService({
      campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.PENDING_APPROVAL, name: 'Spring Sale', requestedById: 'client-user-1' },
    });
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(3)) as any;

    const result = await service.approveSend('client-1', 'campaign-1', 'admin-1');

    expect(result.status).toBe(EmailCampaignStatus.QUEUED);
    expect(prisma.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: EmailCampaignStatus.QUEUED, approvedById: 'admin-1' }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      'client-user-1',
      expect.stringContaining('Spring Sale'),
      '/email-campaigns',
    );
  });

  it('rejects approving a campaign that is not PENDING_APPROVAL', async () => {
    const { service } = buildService({ campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.DRAFT } });
    await expect(service.approveSend('client-1', 'campaign-1', 'admin-1')).rejects.toThrow(
      'not waiting for approval',
    );
  });

  it('rejects a send request, returns the campaign to DRAFT with the reason stored, and notifies the requester', async () => {
    const { service, prisma, notifications } = buildService({
      campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.PENDING_APPROVAL, name: 'Spring Sale', requestedById: 'client-user-1' },
    });

    const result = await service.rejectSend('client-1', 'campaign-1', 'admin-1', 'Fix the typo in the subject');

    expect(result.status).toBe(EmailCampaignStatus.DRAFT);
    expect(prisma.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmailCampaignStatus.DRAFT,
          requestedById: null,
          rejectionReason: 'Fix the typo in the subject',
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      'client-user-1',
      expect.stringContaining('Fix the typo in the subject'),
      '/email-campaigns',
    );
  });

  it('rejects rejecting a campaign that is not PENDING_APPROVAL', async () => {
    const { service } = buildService({ campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.DRAFT } });
    await expect(service.rejectSend('client-1', 'campaign-1', 'admin-1', 'reason')).rejects.toThrow(
      'not waiting for approval',
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
    // The atomic claim (PENDING -> SENT) is what actually performs the status transition now.
    expect(prisma.emailRecipient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1', status: EmailRecipientStatus.PENDING },
        data: expect.objectContaining({ status: EmailRecipientStatus.SENT }),
      }),
    );
    // The follow-up `update` only fills in the unsubscribe token hash — it no longer re-sets status.
    expect(prisma.emailRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1' }, data: expect.objectContaining({ unsubscribeTokenHash: expect.any(String) }) }),
    );
  });

  it('marks a failed delivery as FAILED, not SENT, correcting the optimistic claim', async () => {
    const recipient = { id: 'r1', campaignId: 'campaign-1', name: 'A', email: 'a@example.com', status: EmailRecipientStatus.PENDING };
    const { service, prisma, email } = buildService({
      campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.QUEUED, subject: 'Hi', bodyTemplate: 'x' },
      recipients: [recipient],
    });
    email.send = vi.fn(() => Promise.resolve(false));
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(0)) as any;

    const sent = await service.processQueuedCampaigns();

    expect(sent).toBe(0);
    // Still claimed atomically first (optimistically to SENT)...
    expect(prisma.emailRecipient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1', status: EmailRecipientStatus.PENDING },
        data: expect.objectContaining({ status: EmailRecipientStatus.SENT }),
      }),
    );
    // ...then corrected to FAILED, with sentAt cleared so the FAILED row carries no send timestamp.
    expect(prisma.emailRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ status: EmailRecipientStatus.FAILED, sentAt: null }),
      }),
    );
  });

  it('skips a recipient already claimed by an overlapping run and never attempts to send it', async () => {
    const recipient = { id: 'r1', campaignId: 'campaign-1', name: 'A', email: 'a@example.com', status: EmailRecipientStatus.PENDING };
    const { service, prisma, email } = buildService({
      campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.QUEUED, subject: 'Hi', bodyTemplate: 'x' },
      recipients: [recipient],
    });
    // Simulates losing the atomic claim race — an overlapping run already flipped this row off PENDING.
    prisma.emailRecipient.updateMany = vi.fn(() => Promise.resolve({ count: 0 })) as any;
    prisma.emailRecipient.count = vi.fn(() => Promise.resolve(0)) as any;

    const sent = await service.processQueuedCampaigns();

    expect(sent).toBe(0);
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.emailRecipient.update).not.toHaveBeenCalled();
  });

  it('concurrency invariant: of two overlapping workers claiming the same PENDING recipient, exactly one claims it and exactly one send is attempted', async () => {
    const recipient = { id: 'r1', campaignId: 'campaign-1', name: 'A', email: 'a@example.com', status: EmailRecipientStatus.PENDING };
    const { service: workerA, prisma: prismaA, email: emailA } = buildService({
      campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.QUEUED, subject: 'Hi', bodyTemplate: 'x' },
      recipients: [recipient],
    });
    const { service: workerB, prisma: prismaB, email: emailB } = buildService({
      campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.SENDING, subject: 'Hi', bodyTemplate: 'x' },
      recipients: [recipient],
    });
    prismaA.emailRecipient.count = vi.fn(() => Promise.resolve(0)) as any;
    prismaB.emailRecipient.count = vi.fn(() => Promise.resolve(0)) as any;

    // Shared backing store simulating one real `status: PENDING` row both workers race over: the
    // first updateMany call to actually run against it claims it (count: 1); every call after that
    // sees it's no longer PENDING (count: 0) — exactly how a real `WHERE status = PENDING` guard
    // behaves against one database row under concurrent writers.
    let claimed = false;
    const sharedClaim = vi.fn(() => {
      if (claimed) return Promise.resolve({ count: 0 });
      claimed = true;
      return Promise.resolve({ count: 1 });
    });
    prismaA.emailRecipient.updateMany = sharedClaim as any;
    prismaB.emailRecipient.updateMany = sharedClaim as any;

    const [sentA, sentB] = await Promise.all([
      workerA.processQueuedCampaigns(),
      workerB.processQueuedCampaigns(),
    ]);

    expect(sentA + sentB).toBe(1);
    expect(sharedClaim).toHaveBeenCalledTimes(2);
    const totalSendAttempts = (emailA.send as any).mock.calls.length + (emailB.send as any).mock.calls.length;
    expect(totalSendAttempts).toBe(1);
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

  it('flips the campaign to FAILED — not SENT — when every recipient failed delivery (§21 EmailCampaignStatus terminal state)', async () => {
    const recipient = { id: 'r1', campaignId: 'campaign-1', name: 'A', email: 'a@example.com', status: EmailRecipientStatus.PENDING };
    const { service, prisma, email, notifications } = buildService({
      campaign: {
        id: 'campaign-1', clientId: 'client-1', name: 'Spring Sale', createdById: 'creator-1',
        status: EmailCampaignStatus.QUEUED, subject: 'Hi', bodyTemplate: 'x',
      },
      recipients: [recipient],
    });
    email.send = vi.fn(() => Promise.resolve(false));
    // Every prisma.emailRecipient.count() call in this codepath is (PENDING remaining, then SENT,
    // then FAILED) in that order — mocked per-call since (unlike other tests here) this one
    // actually depends on telling them apart.
    prisma.emailRecipient.count = vi
      .fn()
      .mockResolvedValueOnce(0) // remainingPending
      .mockResolvedValueOnce(0) // sentCount
      .mockResolvedValueOnce(1) as any; // failedCount

    await service.processQueuedCampaigns();

    expect(prisma.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: EmailCampaignStatus.FAILED }) }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      'creator-1',
      expect.stringContaining('Spring Sale'),
      '/email-campaigns',
    );
  });

  it('stays SENT when only some recipients fail — a handful of bounces is not a campaign-level failure', async () => {
    const { service, prisma, notifications } = buildService({
      campaign: { id: 'campaign-1', clientId: 'client-1', status: EmailCampaignStatus.SENDING, subject: 'Hi', bodyTemplate: 'x' },
      recipients: [],
    });
    prisma.emailRecipient.count = vi
      .fn()
      .mockResolvedValueOnce(0) // remainingPending
      .mockResolvedValueOnce(8) // sentCount
      .mockResolvedValueOnce(2) as any; // failedCount

    await service.processQueuedCampaigns();

    expect(prisma.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: EmailCampaignStatus.SENT }) }),
    );
    expect(notifications.create).not.toHaveBeenCalled();
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
