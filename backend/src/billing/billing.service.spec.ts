import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service.js';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { RazorpayService } from './razorpay.service.js';

const VERIFIED_PAYMENT = { orderId: 'order_1', paymentId: 'pay_1', signature: 'sig_1' };

function buildService(overrides: { verifies?: boolean; existingSubscription?: any } = {}) {
  const prisma = {
    subscription: {
      findUnique: vi.fn(() => Promise.resolve(overrides.existingSubscription ?? null)),
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
    verifyWebhookSignature: vi.fn(() => overrides.verifies ?? true),
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
    expect(razorpay.createOrder).toHaveBeenCalledWith(
      999,
      expect.stringContaining('agency-1'),
      expect.objectContaining({ agencyId: 'agency-1', plan: SubscriptionPlan.STARTER, billingCycle: 'MONTHLY' }),
    );
    expect(result).toEqual({ orderId: 'order_1', amount: 999, currency: 'INR', keyId: 'rzp_test_fake' });
  });

  it('uses the yearly price when billingCycle is YEARLY', async () => {
    const { service, razorpay } = buildService();
    await service.createCheckoutOrder('agency-1', { plan: SubscriptionPlan.GROWTH, billingCycle: 'YEARLY' });
    expect(razorpay.createOrder).toHaveBeenCalledWith(24990, expect.any(String), expect.any(Object));
  });

  it('attaches plan/billingCycle as order notes so the webhook can recover them later', async () => {
    const { service, razorpay } = buildService();
    await service.createCheckoutOrder('agency-1', {
      plan: SubscriptionPlan.GROWTH,
      billingCycle: 'YEARLY',
      gstNumber: 'GST123',
    });
    expect(razorpay.createOrder).toHaveBeenCalledWith(24990, expect.any(String), {
      agencyId: 'agency-1',
      plan: SubscriptionPlan.GROWTH,
      billingCycle: 'YEARLY',
      gstNumber: 'GST123',
    });
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

describe('BillingService.activateFromWebhook', () => {
  it('activates the subscription from webhook-recovered notes, with no actor', async () => {
    const { service, prisma, audit } = buildService();
    const result = await service.activateFromWebhook('agency-1', 'pay_webhook_1', {
      plan: SubscriptionPlan.GROWTH,
      billingCycle: 'MONTHLY',
    });
    expect(result.alreadyProcessed).toBe(false);
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ paymentProviderRef: 'pay_webhook_1' }) }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it('is idempotent — does not re-process a payment id already recorded on the subscription', async () => {
    const { service, prisma } = buildService({
      existingSubscription: { id: 'sub-1', agencyId: 'agency-1', paymentProviderRef: 'pay_webhook_1' },
    });
    const result = await service.activateFromWebhook('agency-1', 'pay_webhook_1', {
      plan: SubscriptionPlan.GROWTH,
      billingCycle: 'MONTHLY',
    });
    expect(result.alreadyProcessed).toBe(true);
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });
});

describe('BillingService.processRazorpayWebhook', () => {
  function payload(event: string, notes?: Record<string, string>) {
    return Buffer.from(
      JSON.stringify({
        event,
        payload: { payment: { entity: { id: 'pay_1', notes } } },
      }),
    );
  }

  it('rejects a webhook whose signature does not verify', async () => {
    const { service } = buildService({ verifies: false });
    await expect(service.processRazorpayWebhook(payload('payment.captured'), 'bad-sig')).rejects.toThrow(
      'Invalid webhook signature',
    );
  });

  it('acknowledges but does nothing for event types it does not act on', async () => {
    const { service, prisma } = buildService();
    const result = await service.processRazorpayWebhook(payload('payment.failed'), 'sig');
    expect(result).toEqual({ received: true, handled: false });
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it('acknowledges but skips activation if the payment has no recognizable order notes', async () => {
    const { service, prisma } = buildService();
    const result = await service.processRazorpayWebhook(payload('payment.captured', {}), 'sig');
    expect(result).toEqual({ received: true, handled: false });
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it('activates the subscription for a verified payment.captured event with valid notes', async () => {
    const { service, prisma } = buildService();
    const result = await service.processRazorpayWebhook(
      payload('payment.captured', { agencyId: 'agency-1', plan: 'GROWTH', billingCycle: 'MONTHLY' }),
      'sig',
    );
    expect(result).toEqual({ received: true, handled: true, alreadyProcessed: false });
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ plan: 'GROWTH', paymentProviderRef: 'pay_1' }) }),
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
