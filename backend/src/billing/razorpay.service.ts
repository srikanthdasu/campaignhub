import { createHmac, timingSafeEqual } from 'crypto';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

// Raw REST calls rather than the razorpay npm SDK — same reasoning as AzureAiFoundryService:
// one small, well-documented endpoint doesn't need a dependency to wrap it.
@Injectable()
export class RazorpayService {
  constructor(private config: ConfigService) {}

  get keyId(): string {
    return this.config.getOrThrow<string>('RAZORPAY_KEY_ID');
  }

  private authHeader(): string {
    const keySecret = this.config.getOrThrow<string>('RAZORPAY_KEY_SECRET');
    return 'Basic ' + Buffer.from(`${this.keyId}:${keySecret}`).toString('base64');
  }

  /** amountInRupees is a whole-rupee amount (matches PLANS' priceInr fields); Razorpay bills in paise. */
  async createOrder(amountInRupees: number, receipt: string): Promise<RazorpayOrder> {
    let res: Response;
    try {
      res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.authHeader() },
        body: JSON.stringify({ amount: Math.round(amountInRupees * 100), currency: 'INR', receipt }),
      });
    } catch {
      throw new BadGatewayException('Could not reach Razorpay. Please try again.');
    }

    if (!res.ok) {
      throw new BadGatewayException(`Razorpay order creation failed (${res.status}). Please try again.`);
    }

    return (await res.json()) as RazorpayOrder;
  }

  // The Checkout.js callback hands the client an order id, payment id, and a signature —
  // trusting those values as-is would let anyone POST a fake "it succeeded" straight to our API
  // without ever paying. Recomputing HMAC-SHA256("order_id|payment_id", key_secret) and comparing
  // it to the signature Razorpay actually returned is what proves the payment is real.
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const keySecret = this.config.getOrThrow<string>('RAZORPAY_KEY_SECRET');
    const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');

    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature);
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }
}
