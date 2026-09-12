import { createHmac } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { RazorpayService } from './razorpay.service.js';
import type { ConfigService } from '@nestjs/config';

const KEY_SECRET = 'test_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

function buildService() {
  const config = {
    getOrThrow: vi.fn((key: string) => {
      if (key === 'RAZORPAY_KEY_SECRET') return KEY_SECRET;
      if (key === 'RAZORPAY_WEBHOOK_SECRET') return WEBHOOK_SECRET;
      return 'rzp_test_id';
    }),
  };
  return new RazorpayService(config as unknown as ConfigService);
}

describe('RazorpayService.verifyPaymentSignature', () => {
  it('accepts a signature genuinely computed from the order id and payment id', () => {
    const service = buildService();
    const signature = createHmac('sha256', KEY_SECRET).update('order_1|pay_1').digest('hex');
    expect(service.verifyPaymentSignature('order_1', 'pay_1', signature)).toBe(true);
  });

  it('rejects a signature for a different order/payment pair', () => {
    const service = buildService();
    const signature = createHmac('sha256', KEY_SECRET).update('order_1|pay_1').digest('hex');
    expect(service.verifyPaymentSignature('order_2', 'pay_1', signature)).toBe(false);
  });

  it('rejects a forged signature of the wrong length rather than throwing', () => {
    const service = buildService();
    expect(service.verifyPaymentSignature('order_1', 'pay_1', 'not-a-real-signature')).toBe(false);
  });
});

describe('RazorpayService.createOrder', () => {
  it("surfaces Razorpay's own error description instead of just the HTTP status", async () => {
    const service = buildService();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({ error: { description: 'receipt: the length must be no more than 56.' } }),
        }),
      ),
    );

    await expect(service.createOrder(999, 'a'.repeat(60))).rejects.toThrow(
      'receipt: the length must be no more than 56.',
    );

    vi.unstubAllGlobals();
  });

  it('passes notes through so a webhook can recover plan/billingCycle without the browser', async () => {
    const service = buildService();
    const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'order_1', amount: 99900, currency: 'INR' }) }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await service.createOrder(999, 'receipt-1', { agencyId: 'agency-1', plan: 'GROWTH' });

    const requestInit = fetchMock.mock.calls[0][1];
    const body = JSON.parse(requestInit.body as string);
    expect(body.notes).toEqual({ agencyId: 'agency-1', plan: 'GROWTH' });

    vi.unstubAllGlobals();
  });
});

describe('RazorpayService.verifyWebhookSignature', () => {
  it('accepts a signature genuinely computed over the raw body with the webhook secret', () => {
    const service = buildService();
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const signature = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
    expect(service.verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret (e.g. the payment key secret)', () => {
    const service = buildService();
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const wrongSignature = createHmac('sha256', KEY_SECRET).update(rawBody).digest('hex');
    expect(service.verifyWebhookSignature(rawBody, wrongSignature)).toBe(false);
  });

  it('rejects a signature if even one byte of the body differs', () => {
    const service = buildService();
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const signature = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
    const tamperedBody = Buffer.from('{"event":"payment.failed"}');
    expect(service.verifyWebhookSignature(tamperedBody, signature)).toBe(false);
  });
});
