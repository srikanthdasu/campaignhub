import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service.js';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { RazorpayService } from './razorpay.service.js';

const VERIFIED_PAYMENT = { orderId: 'order_1', paymentId: 'pay_1', signature: 'sig_1' };

function buildService(overrides: { verifies?: boolean } = {}) {
  const prisma = {
    subscription: {
      upsert: vi.fn((args: any) => Promise.resolve({ id: 'sub-1', agencyId: 'agency-1', ...args.create })),
    },
    invoice: {
      create: vi.fn((args: any) => Promise.resolve({ id: 'inv-1', ...args.data })),
    },
  };
  const audit = { log: vi.fn() };
  const razorpay = {
    keyId: 'rzp_test_fake',
    createOrder: vi.fn((amount: number) => Promise.resolve({ id: 'order_1', amount: amount * 100, currency: 'INR' })),
    verifyPaymentSignature: vi.fn(() => overrides.verifies ?? true),
  };
  const service = new BillingService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    razorpay as unknown as RazorpayService,
  );
  return { service, prisma, audit, razorpay };
}

describe('BillingService.createCheckoutOrder', () => {
  it('opens a real Razorpay order for the monthly Starter price', async () => {
    const { service, razorpay } = buildService();
    const result = await service.createCheckoutOrder('agency-1', {
      plan: SubscriptionPlan.STARTER,
      billingCycle: 'MONTHLY',
    });
    expect(razorpay.createOrder).toHaveBeenCalledWith(999, expect.stringContaining('agency-1'));
    expect(result).toEqual({ orderId: 'order_1', amount: 999, currency: 'INR', keyId: 'rzp_test_fake' });
  });

  it('uses the yearly price when billingCycle is YEARLY', async () => {
    const { service, razorpay } = buildService();
    await service.createCheckoutOrder('agency-1', { plan: SubscriptionPlan.GROWTH, billingCycle: 'YEARLY' });
    expect(razorpay.createOrder).toHaveBeenCalledWith(24990, expect.any(String));
  });

  it('refuses self-serve checkout for the custom-priced Enterprise plan', async () => {
    const { service } = buildService();
    await expect(
      service.createCheckoutOrder('agency-1', { plan: SubscriptionPlan.ENTERPRISE, billingCycle: 'MONTHLY' }),
    ).rejects.toThrow('custom');
  });
});

describe('BillingService.confirmSubscription', () => {
  it('rejects a payment whose signature does not verify', async () => {
    const { service } = buildService({ verifies: false });
    await expect(
      service.confirmSubscription('agency-1', 'owner-1', {
        plan: SubscriptionPlan.STARTER,
        billingCycle: 'MONTHLY',
        ...VERIFIED_PAYMENT,
      }),
    ).rejects.toThrow('verification failed');
  });

  it('computes 18% GST on the monthly Starter price once the payment verifies', async () => {
    const { service } = buildService();
    const { invoice } = await service.confirmSubscription('agency-1', 'owner-1', {
      plan: SubscriptionPlan.STARTER,
      billingCycle: 'MONTHLY',
      ...VERIFIED_PAYMENT,
    });
    expect(invoice.amount).toBe(999);
    expect(invoice.gstAmount).toBe(179.82);
  });

  it('activates the subscription and records the Razorpay payment id', async () => {
    const { service, prisma } = buildService();
    const { subscription } = await service.confirmSubscription('agency-1', 'owner-1', {
      plan: SubscriptionPlan.STARTER,
      billingCycle: 'MONTHLY',
      ...VERIFIED_PAYMENT,
    });
    expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ paymentProviderRef: 'pay_1' }),
      }),
    );
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
    const service = new BillingService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      {} as unknown as RazorpayService,
    );

    const result = await service.cancel('agency-1', 'owner-1');
    expect(result.status).toBe(SubscriptionStatus.CANCELLED);
  });
});
