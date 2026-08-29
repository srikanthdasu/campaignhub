import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service.js';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

describe('BillingService.subscribe', () => {
  let prisma: any;
  let audit: any;
  let service: BillingService;

  beforeEach(() => {
    prisma = {
      subscription: {
        upsert: vi.fn((args: any) => Promise.resolve({ id: 'sub-1', agencyId: 'agency-1', ...args.create })),
      },
      invoice: {
        create: vi.fn((args: any) => Promise.resolve({ id: 'inv-1', ...args.data })),
      },
    };
    audit = { log: vi.fn() };
    service = new BillingService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  });

  it('computes 18% GST on the monthly Starter price', async () => {
    const { invoice } = await service.subscribe('agency-1', 'owner-1', {
      plan: SubscriptionPlan.STARTER,
      billingCycle: 'MONTHLY',
    });
    expect(invoice.amount).toBe(999);
    expect(invoice.gstAmount).toBe(179.82);
  });

  it('uses the yearly price when billingCycle is YEARLY', async () => {
    const { invoice } = await service.subscribe('agency-1', 'owner-1', {
      plan: SubscriptionPlan.GROWTH,
      billingCycle: 'YEARLY',
    });
    expect(invoice.amount).toBe(24990);
    expect(invoice.gstAmount).toBe(4498.2);
  });

  it('marks the subscription active without a real payment gateway', async () => {
    const { subscription } = await service.subscribe('agency-1', 'owner-1', {
      plan: SubscriptionPlan.STARTER,
      billingCycle: 'MONTHLY',
    });
    expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('refuses self-serve checkout for the custom-priced Enterprise plan', async () => {
    await expect(
      service.subscribe('agency-1', 'owner-1', { plan: SubscriptionPlan.ENTERPRISE, billingCycle: 'MONTHLY' }),
    ).rejects.toThrow('custom');
  });
});

describe('BillingService.cancel', () => {
  it('marks the subscription cancelled', async () => {
    const prisma = {
      subscription: {
        update: vi.fn((args: any) => Promise.resolve({ id: 'sub-1', ...args.data })),
      },
    };
    const audit = { log: vi.fn() };
    const service = new BillingService(prisma as unknown as PrismaService, audit as unknown as AuditService);

    const result = await service.cancel('agency-1', 'owner-1');
    expect(result.status).toBe(SubscriptionStatus.CANCELLED);
  });
});
