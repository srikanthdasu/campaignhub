import { describe, expect, it, vi } from 'vitest';
import { AgenciesService } from './agencies.service.js';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

function buildService(overrides: { agency?: unknown; subscription?: unknown } = {}) {
  const audit = { log: vi.fn() };
  const prisma = {
    agency: {
      findUnique: vi.fn(() =>
        Promise.resolve(
          overrides.agency ?? { id: 'agency-1', name: 'Acme', settings: null, createdAt: new Date() },
        ),
      ),
      update: vi.fn((args: { where: { id: string } }) =>
        Promise.resolve({ id: args.where.id, name: 'Acme Updated', settings: null, createdAt: new Date() }),
      ),
    },
    subscription: {
      findUnique: vi.fn(() => Promise.resolve(overrides.subscription ?? null)),
    },
  };
  const service = new AgenciesService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, prisma, audit };
}

describe('AgenciesService.getMine', () => {
  it('never returns stripeCustomerId — it is not even selected from the DB', async () => {
    const { service, prisma } = buildService();
    await service.getMine('agency-1');
    expect(prisma.agency.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, name: true, settings: true, createdAt: true },
      }),
    );
  });

  it('derives plan/subscriptionStatus from the real Subscription row when one exists', async () => {
    const { service } = buildService({
      subscription: { plan: SubscriptionPlan.GROWTH, status: SubscriptionStatus.ACTIVE },
    });

    const result = await service.getMine('agency-1');

    expect(result.plan).toBe(SubscriptionPlan.GROWTH);
    expect(result.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);
  });

  it('falls back to no plan / TRIAL when the agency has never subscribed', async () => {
    const { service } = buildService({ subscription: null });

    const result = await service.getMine('agency-1');

    expect(result.plan).toBeNull();
    expect(result.subscriptionStatus).toBe(SubscriptionStatus.TRIAL);
  });
});

describe('AgenciesService.updateSettings', () => {
  it('also derives plan/subscriptionStatus from Subscription, not the raw update result', async () => {
    const { service } = buildService({
      subscription: { plan: SubscriptionPlan.STARTER, status: SubscriptionStatus.ACTIVE },
    });

    const result = await service.updateSettings('agency-1', 'actor-1', { name: 'New name' });

    expect(result.plan).toBe(SubscriptionPlan.STARTER);
    expect(result.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);
  });
});
