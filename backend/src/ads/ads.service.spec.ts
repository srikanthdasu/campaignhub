import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdsService } from './ads.service.js';
import { AdStatus, Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { sub: 'reviewer-1', email: 'a@b.com', role: Role.OWNER, agencyId: 'agency-1', ...overrides };
}

function buildAd(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ad-1',
    clientId: 'client-1',
    campaignId: null,
    name: 'Summer Sale',
    objective: null,
    platform: 'INSTAGRAM',
    audienceNotes: null,
    budgetAmount: null,
    budgetCurrency: 'USD',
    creativeText: null,
    creativeMediaAssetId: null,
    status: AdStatus.DRAFT,
    approvedById: null,
    approvedAt: null,
    launchedAt: null,
    createdById: 'creator-1',
    ...overrides,
  };
}

describe('AdsService', () => {
  let prisma: any;
  let audit: any;
  let notifications: any;
  let service: AdsService;
  let adState: ReturnType<typeof buildAd>;

  beforeEach(() => {
    adState = buildAd();
    prisma = {
      adCampaign: {
        findUnique: vi.fn(() => Promise.resolve(adState)),
        update: vi.fn((args: any) => {
          adState = { ...adState, ...args.data };
          return Promise.resolve(adState);
        }),
        delete: vi.fn(() => Promise.resolve(adState)),
      },
    };
    audit = { log: vi.fn() };
    notifications = { create: vi.fn(), createMany: vi.fn() };
    service = new AdsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      notifications as unknown as NotificationsService,
    );
  });

  it('refuses to submit for approval without a budget and creative', async () => {
    await expect(service.submitForApproval('client-1', 'ad-1', 'creator-1')).rejects.toThrow(
      'Budget and creative must be set',
    );
  });

  it('refuses to submit an ad that is not in draft', async () => {
    adState.status = AdStatus.PENDING_APPROVAL;
    await expect(service.submitForApproval('client-1', 'ad-1', 'creator-1')).rejects.toThrow(
      'Only a draft ad can be submitted',
    );
  });

  it('submits a fully-briefed draft for approval', async () => {
    adState.budgetAmount = 500;
    adState.creativeText = 'Shop now';
    const result = await service.submitForApproval('client-1', 'ad-1', 'creator-1');
    expect(result.status).toBe(AdStatus.PENDING_APPROVAL);
  });

  it('refuses to review an ad that is not pending approval', async () => {
    const user = makeUser();
    await expect(
      service.review('client-1', 'ad-1', user, { status: AdStatus.APPROVED }),
    ).rejects.toThrow('Only an ad pending approval can be reviewed');
  });

  it('approves a pending ad and records the reviewer', async () => {
    adState.status = AdStatus.PENDING_APPROVAL;
    const user = makeUser({ sub: 'owner-1' });
    const result = await service.review('client-1', 'ad-1', user, { status: AdStatus.APPROVED });
    expect(result.status).toBe(AdStatus.APPROVED);
    expect(result.approvedById).toBe('owner-1');
    expect(result.approvedAt).toBeInstanceOf(Date);
  });

  it('refuses to launch an ad that is not approved', async () => {
    await expect(service.launch('client-1', 'ad-1', 'owner-1')).rejects.toThrow(
      'Only an approved ad can be launched',
    );
  });

  it('launches an approved ad', async () => {
    adState.status = AdStatus.APPROVED;
    const result = await service.launch('client-1', 'ad-1', 'owner-1');
    expect(result.status).toBe(AdStatus.LAUNCHED);
    expect(result.launchedAt).toBeInstanceOf(Date);
  });

  it('resets a rejected ad back to draft when edited', async () => {
    adState.status = AdStatus.REJECTED;
    const result = await service.update('client-1', 'ad-1', 'creator-1', { name: 'Revised name' });
    expect(result.status).toBe(AdStatus.DRAFT);
    expect(result.name).toBe('Revised name');
  });

  it('refuses to edit an ad pending approval', async () => {
    adState.status = AdStatus.PENDING_APPROVAL;
    await expect(
      service.update('client-1', 'ad-1', 'creator-1', { name: 'Nope' }),
    ).rejects.toThrow('can no longer be edited');
  });

  it('refuses to delete anything but a draft', async () => {
    adState.status = AdStatus.LAUNCHED;
    await expect(service.remove('client-1', 'ad-1', 'owner-1')).rejects.toThrow(
      'Only a draft ad can be deleted',
    );
  });
});
