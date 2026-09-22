import { describe, expect, it, vi } from 'vitest';
import { CampaignsService } from './campaigns.service.js';
import { CampaignStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

function buildService(overrides: { campaign?: any; agencyUsers?: { id: string }[] } = {}) {
  const campaign = overrides.campaign ?? { id: 'campaign-1', clientId: 'client-1', status: CampaignStatus.DRAFT };
  const agencyUsers = overrides.agencyUsers ?? [{ id: 'staff-1' }, { id: 'staff-2' }];
  const audit = { log: vi.fn() };
  const prisma = {
    campaign: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'campaign-1', ...args.data })),
      findUnique: vi.fn(() => Promise.resolve(campaign)),
      update: vi.fn((args: any) => Promise.resolve({ ...campaign, ...args.data })),
      delete: vi.fn(() => Promise.resolve({})),
    },
    user: {
      findMany: vi.fn((args: any) =>
        Promise.resolve(agencyUsers.filter((u) => args.where.id.in.includes(u.id))),
      ),
    },
  };
  const service = new CampaignsService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, audit, campaign };
}

describe('CampaignsService', () => {
  it('rejects operating on a campaign from a different client', async () => {
    const { service } = buildService({ campaign: { id: 'campaign-1', clientId: 'other-client', status: CampaignStatus.DRAFT } });
    await expect(service.update('client-1', 'campaign-1', 'actor-1', 'agency-1', {} as any)).rejects.toThrow(
      'Campaign not found for this client',
    );
  });

  it('rejects assigning a campaign to a user outside the agency (AUTH-2)', async () => {
    const { service, prisma } = buildService();
    await expect(
      service.update('client-1', 'campaign-1', 'actor-1', 'agency-1', { assignedToId: 'foreign-user' } as any),
    ).rejects.toThrow('assignedToId and reviewerId must belong to your agency');
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('rejects a foreign reviewerId even when assignedToId is valid', async () => {
    const { service } = buildService();
    await expect(
      service.update('client-1', 'campaign-1', 'actor-1', 'agency-1', {
        assignedToId: 'staff-1',
        reviewerId: 'foreign-user',
      } as any),
    ).rejects.toThrow('assignedToId and reviewerId must belong to your agency');
  });

  it('allows assigning a campaign to real agency staff', async () => {
    const { service, prisma } = buildService();
    await service.update('client-1', 'campaign-1', 'actor-1', 'agency-1', {
      assignedToId: 'staff-1',
      reviewerId: 'staff-2',
    } as any);
    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToId: 'staff-1', reviewerId: 'staff-2' }) }),
    );
  });

  it('allows deleting a DRAFT campaign', async () => {
    const { service, prisma } = buildService();
    await service.remove('client-1', 'campaign-1', 'actor-1');
    expect(prisma.campaign.delete).toHaveBeenCalledWith({ where: { id: 'campaign-1' } });
  });

  it('rejects deleting a non-DRAFT campaign', async () => {
    const { service, prisma } = buildService({ campaign: { id: 'campaign-1', clientId: 'client-1', status: CampaignStatus.ACTIVE } });
    await expect(service.remove('client-1', 'campaign-1', 'actor-1')).rejects.toThrow(
      'Only draft campaigns can be deleted',
    );
    expect(prisma.campaign.delete).not.toHaveBeenCalled();
  });
});
