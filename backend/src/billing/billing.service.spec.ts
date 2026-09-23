import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service.js';
import { InvoiceStatus, SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { RazorpayService } from './razorpay.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';

const VERIFIED_PAYMENT = { orderId: 'order_1', paymentId: 'pay_1', signature: 'sig_1' };

function buildService(
  overrides: {
    verifies?: boolean;
    existingSubscription?: any;
    orderNotes?: Record<string, string> | undefined;
    // Simulates Invoice.paymentProviderRef's unique constraint firing on create — the real
    // idempotency backstop for BILL-2.
    duplicatePaymentRef?: boolean;
    existingInvoice?: any;
    invoice?: any;
  } = {},
) {
  const prisma = {
    subscription: {
      findUnique: vi.fn(() => Promise.resolve(overrides.existingSubscription ?? null)),
      upsert: vi.fn((args: any) => Promise.resolve({ id: 'sub-1', agencyId: 'agency-1', ...args.create })),
    },
    invoice: {
      create: vi.fn((args: any) => {
        if (overrides.duplicatePaymentRef) {
          return Promise.reject(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
        }
        return Promise.resolve({ id: 'inv-1', ...args.data });
      }),
      findUniqueOrThrow: vi.fn(() =>
        Promise.resolve(overrides.existingInvoice ?? { id: 'inv-existing', amount: 999, gstAmount: 179.82 }),
      ),
      findUnique: vi.fn(() =>
        Promise.resolve(
          'invoice' in overrides ? overrides.invoice : {
            id: 'inv-1',
            agencyId: 'agency-1',
            status: InvoiceStatus.PAID,
            paymentProviderRef: 'pay_1',
            amount: 999,
            gstAmount: 179.82,
          },
        ),
      ),
      update: vi.fn((args: any) => Promise.resolve({ ...(overrides.invoice ?? { id: 'inv-1' }), ...args.data })),
    },
    user: {
      findMany: vi.fn(() => Promise.resolve([{ id: 'admin-1' }])),
    },
  };
  const audit = { log: vi.fn() };
  const notifications = { create: vi.fn(), createMany: vi.fn() };
  const razorpay = {
    keyId: 'rzp_test_fake',
    createOrder: vi.fn((amount: number) => Promise.resolve({ id: 'order_1', amount: amount * 100, currency: 'INR' })),
    fetchOrder: vi.fn(() =>
      Promise.resolve({
        id: 'order_1',
        amount: 99900,
        currency: 'INR',
        notes:
          overrides.orderNotes === undefined
            ? { agencyId: 'agency-1', plan: SubscriptionPlan.STARTER, billingCycle: 'MONTHLY' }
            : overrides.orderNotes,
      }),
    ),
    verifyPaymentSignature: vi.fn(() => overrides.verifies ?? true),
    verifyWebhookSignature: vi.fn(() => overrides.verifies ?? true),
    refundPayment: vi.fn(() => Promise.resolve({ id: 'rfnd_1', payment_id: 'pay_1', amount: 99900, status: 'processed' })),
  };
  const service = new BillingService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    razorpay as unknown as RazorpayService,
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, audit, razorpay, notifications };
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

  it('activates the plan recorded on the verified Razorpay order, ignoring a different plan sent in the request body', async () => {
    // Regression test for the plan-tampering fix: the order was genuinely created (and paid for)
    // as STARTER/MONTHLY — a request claiming GROWTH/YEARLY in the body must not be trusted.
    const { service, prisma } = buildService({
      orderNotes: { agencyId: 'agency-1', plan: SubscriptionPlan.STARTER, billingCycle: 'MONTHLY' },
    });
    const { subscription, invoice } = await service.confirmSubscription('agency-1', 'owner-1', {
      plan: SubscriptionPlan.GROWTH,
      billingCycle: 'YEARLY',
      ...VERIFIED_PAYMENT,
    });
    expect(subscription.plan).toBe(SubscriptionPlan.STARTER);
    expect(invoice.amount).toBe(999);
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ plan: SubscriptionPlan.STARTER, billingCycle: 'MONTHLY' }) }),
    );
  });

  it('rejects confirmation when the verified order belongs to a different agency', async () => {
    const { service } = buildService({
      orderNotes: { agencyId: 'agency-OTHER', plan: SubscriptionPlan.STARTER, billingCycle: 'MONTHLY' },
    });
    await expect(
      service.confirmSubscription('agency-1', 'owner-1', {
        plan: SubscriptionPlan.STARTER,
        billingCycle: 'MONTHLY',
        ...VERIFIED_PAYMENT,
      }),
    ).rejects.toThrow('does not belong to your agency');
  });

  it('rejects confirmation when the order has no recoverable plan notes', async () => {
    const { service } = buildService({ orderNotes: {} });
    await expect(
      service.confirmSubscription('agency-1', 'owner-1', {
        plan: SubscriptionPlan.STARTER,
        billingCycle: 'MONTHLY',
        ...VERIFIED_PAYMENT,
      }),
    ).rejects.toThrow('Could not verify what this order was for');
  });

  it('is idempotent against a double-submit — returns the existing invoice instead of creating a duplicate (BILL-2)', async () => {
    const { service, prisma } = buildService({
      duplicatePaymentRef: true,
      existingInvoice: { id: 'inv-existing', amount: 999, gstAmount: 179.82 },
    });
    const result = await service.confirmSubscription('agency-1', 'owner-1', {
      plan: SubscriptionPlan.STARTER,
      billingCycle: 'MONTHLY',
      ...VERIFIED_PAYMENT,
    });
    expect(result.alreadyProcessed).toBe(true);
    expect(result.invoice.id).toBe('inv-existing');
    expect(prisma.invoice.findUniqueOrThrow).toHaveBeenCalledWith({ where: { paymentProviderRef: 'pay_1' } });
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

  it('falls back to the Invoice-level idempotency guard when the subscription fast path misses (BILL-2)', async () => {
    // Subscription.paymentProviderRef has since moved on to a newer payment — the fast path
    // above can't catch this older webhook retry, but the Invoice unique constraint still must.
    const { service, prisma } = buildService({
      existingSubscription: { id: 'sub-1', agencyId: 'agency-1', paymentProviderRef: 'pay_newer' },
      duplicatePaymentRef: true,
      existingInvoice: { id: 'inv-existing', amount: 999, gstAmount: 179.82 },
    });
    const result = await service.activateFromWebhook('agency-1', 'pay_webhook_1', {
      plan: SubscriptionPlan.GROWTH,
      billingCycle: 'MONTHLY',
    });
    expect(result.alreadyProcessed).toBe(true);
    expect(result.invoice.id).toBe('inv-existing');
    expect(prisma.subscription.upsert).toHaveBeenCalled();
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
    const { service, prisma, notifications } = buildService();
    const result = await service.processRazorpayWebhook(
      payload('payment.captured', { agencyId: 'agency-1', plan: 'GROWTH', billingCycle: 'MONTHLY' }),
      'sig',
    );
    expect(result).toEqual({ received: true, handled: true, alreadyProcessed: false });
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ plan: 'GROWTH', paymentProviderRef: 'pay_1' }) }),
    );
    expect(notifications.createMany).toHaveBeenCalledWith(['admin-1'], expect.stringContaining('active'), '/billing');
  });

  it('notifies agency admins on a payment.failed event with recognizable notes (NOTIF-1)', async () => {
    const { service, notifications } = buildService();
    const result = await service.processRazorpayWebhook(
      payload('payment.failed', { agencyId: 'agency-1', plan: 'GROWTH', billingCycle: 'MONTHLY' }),
      'sig',
    );
    expect(result).toEqual({ received: true, handled: true });
    expect(notifications.createMany).toHaveBeenCalledWith(['admin-1'], expect.stringContaining('failed'), '/billing');
  });
});

describe('BillingService.cancel', () => {
  it('marks the subscription cancelled and notifies agency admins (NOTIF-1)', async () => {
    const prisma = {
      subscription: {
        update: vi.fn((args: any) => Promise.resolve({ id: 'sub-1', ...args.data })),
      },
      user: {
        findMany: vi.fn(() => Promise.resolve([{ id: 'admin-1' }, { id: 'admin-2' }])),
      },
    };
    const audit = { log: vi.fn() };
    const notifications = { create: vi.fn(), createMany: vi.fn() };
    const service = new BillingService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      {} as unknown as RazorpayService,
      notifications as unknown as NotificationsService,
    );

    const result = await service.cancel('agency-1', 'owner-1');
    expect(result.status).toBe(SubscriptionStatus.CANCELLED);
    expect(notifications.createMany).toHaveBeenCalledWith(
      ['admin-1', 'admin-2'],
      expect.stringContaining('cancelled'),
      '/billing',
    );
  });
});

describe('BillingService.refundInvoice (§21 InvoiceStatus terminal state)', () => {
  it('refunds via Razorpay and marks the invoice REFUNDED', async () => {
    const { service, prisma, audit, razorpay, notifications } = buildService();

    const result = await service.refundInvoice('agency-1', 'owner-1', 'inv-1');

    expect(razorpay.refundPayment).toHaveBeenCalledWith('pay_1');
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: InvoiceStatus.REFUNDED },
    });
    expect(result.status).toBe(InvoiceStatus.REFUNDED);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INVOICE_REFUNDED', entityId: 'inv-1' }),
    );
    expect(notifications.createMany).toHaveBeenCalledWith(
      ['admin-1'],
      expect.stringContaining('refunded'),
      '/billing',
    );
  });

  it('rejects refunding an invoice that was never paid', async () => {
    const { service, prisma, razorpay } = buildService({
      invoice: { id: 'inv-1', agencyId: 'agency-1', status: InvoiceStatus.ISSUED, paymentProviderRef: null },
    });

    await expect(service.refundInvoice('agency-1', 'owner-1', 'inv-1')).rejects.toThrow(
      'Only a paid invoice can be refunded',
    );
    expect(razorpay.refundPayment).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('rejects refunding an invoice already REFUNDED or VOID', async () => {
    const { service } = buildService({
      invoice: { id: 'inv-1', agencyId: 'agency-1', status: InvoiceStatus.REFUNDED, paymentProviderRef: 'pay_1' },
    });

    await expect(service.refundInvoice('agency-1', 'owner-1', 'inv-1')).rejects.toThrow(
      'Only a paid invoice can be refunded',
    );
  });

  it('rejects an invoice belonging to a different agency (tenant isolation)', async () => {
    const { service } = buildService({
      invoice: { id: 'inv-1', agencyId: 'other-agency', status: InvoiceStatus.PAID, paymentProviderRef: 'pay_1' },
    });

    await expect(service.refundInvoice('agency-1', 'owner-1', 'inv-1')).rejects.toThrow('Invoice not found');
  });

  it('rejects a 404 for a nonexistent invoice', async () => {
    const { service } = buildService({ invoice: null });

    await expect(service.refundInvoice('agency-1', 'owner-1', 'missing')).rejects.toThrow('Invoice not found');
  });

  it('propagates a Razorpay refund failure without marking the invoice REFUNDED', async () => {
    const { prisma } = buildService();
    prisma.invoice.update = vi.fn();
    const failingRazorpay = {
      refundPayment: vi.fn(() => Promise.reject(new Error('Razorpay refund failed: already refunded'))),
    };
    const service2 = new BillingService(
      prisma as unknown as PrismaService,
      { log: vi.fn() } as unknown as AuditService,
      failingRazorpay as unknown as RazorpayService,
      { create: vi.fn(), createMany: vi.fn() } as unknown as NotificationsService,
    );

    await expect(service2.refundInvoice('agency-1', 'owner-1', 'inv-1')).rejects.toThrow('already refunded');
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });
});

describe('BillingService.voidInvoice (§21 InvoiceStatus terminal state)', () => {
  it('marks the invoice VOID without calling Razorpay', async () => {
    const { service, prisma, audit, razorpay } = buildService({
      invoice: { id: 'inv-1', agencyId: 'agency-1', status: InvoiceStatus.PAID, paymentProviderRef: 'pay_1' },
    });

    const result = await service.voidInvoice('agency-1', 'owner-1', 'inv-1');

    expect(razorpay.refundPayment).not.toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: 'inv-1' }, data: { status: InvoiceStatus.VOID } });
    expect(result.status).toBe(InvoiceStatus.VOID);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'INVOICE_VOIDED', entityId: 'inv-1' }));
  });

  it('rejects voiding an invoice that is already REFUNDED or VOID', async () => {
    const { service, prisma } = buildService({
      invoice: { id: 'inv-1', agencyId: 'agency-1', status: InvoiceStatus.VOID, paymentProviderRef: 'pay_1' },
    });

    await expect(service.voidInvoice('agency-1', 'owner-1', 'inv-1')).rejects.toThrow(
      'This invoice has already been resolved',
    );
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('rejects an invoice belonging to a different agency (tenant isolation)', async () => {
    const { service } = buildService({
      invoice: { id: 'inv-1', agencyId: 'other-agency', status: InvoiceStatus.PAID },
    });

    await expect(service.voidInvoice('agency-1', 'owner-1', 'inv-1')).rejects.toThrow('Invoice not found');
  });
});
