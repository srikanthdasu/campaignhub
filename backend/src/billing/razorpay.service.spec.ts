import { createHmac } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { RazorpayService } from './razorpay.service.js';
import type { ConfigService } from '@nestjs/config';

const KEY_SECRET = 'test_secret';

function buildService() {
  const config = { getOrThrow: vi.fn((key: string) => (key === 'RAZORPAY_KEY_SECRET' ? KEY_SECRET : 'rzp_test_id')) };
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
});
