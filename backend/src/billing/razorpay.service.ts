import { createHmac, timingSafeEqual } from 'crypto';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  notes?: Record<string, string>;
}

interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
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

  /**
   * amountInRupees is a whole-rupee amount (matches PLANS' priceInr fields); Razorpay bills in
   * paise. `notes` are stored on the order (and copied onto its payment) by Razorpay itself —
   * the webhook handler reads them back to know which plan/billing cycle to activate without
   * depending on the browser ever calling back, unlike the checkout/verify confirmation path.
   */
  async createOrder(amountInRupees: number, receipt: string, notes?: Record<string, string>): Promise<RazorpayOrder> {
    let res: Response;
    try {
      res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.authHeader() },
        body: JSON.stringify({ amount: Math.round(amountInRupees * 100), currency: 'INR', receipt, notes }),
      });
    } catch {
      throw new BadGatewayException('Could not reach Razorpay. Please try again.');
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { description?: string } } | null;
      const detail = body?.error?.description;
      throw new BadGatewayException(
        detail ? `Razorpay order creation failed: ${detail}` : `Razorpay order creation failed (${res.status}).`,
      );
    }

    return (await res.json()) as RazorpayOrder;
  }

  /**
   * Re-fetches an order directly from Razorpay by id, including the `notes` this service itself
   * set at createOrder time (plan/billingCycle/agencyId/gstNumber). The checkout-confirmation
   * path uses this to recover which plan an order was actually for, rather than trusting the
   * plan/billingCycle a client sends back in the confirm request body — the payment signature
   * only proves a payment happened, never what it was for, so anything about *what plan to
   * activate* has to come from Razorpay's own record of the order, not the client.
   */
  async fetchOrder(orderId: string): Promise<RazorpayOrder> {
    let res: Response;
    try {
      res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
        headers: { Authorization: this.authHeader() },
      });
    } catch {
      throw new BadGatewayException('Could not reach Razorpay. Please try again.');
    }

    if (!res.ok) {
      throw new BadGatewayException(`Could not verify the Razorpay order (${res.status}).`);
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

  /**
   * Issues a full refund against an already-captured payment. No `amount` is sent — omitting it
   * tells Razorpay to refund the payment's full captured amount, which is all this app currently
   * needs (BillingService.refundInvoice only ever refunds a whole invoice, never a partial
   * amount). Razorpay's refund id is itself the idempotency key on their side: retrying this same
   * call for a payment that's already fully refunded returns their existing refund, not a
   * duplicate one.
   */
  async refundPayment(paymentId: string): Promise<RazorpayRefund> {
    let res: Response;
    try {
      res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.authHeader() },
        body: JSON.stringify({}),
      });
    } catch {
      throw new BadGatewayException('Could not reach Razorpay. Please try again.');
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { description?: string } } | null;
      const detail = body?.error?.description;
      throw new BadGatewayException(
        detail ? `Razorpay refund failed: ${detail}` : `Razorpay refund failed (${res.status}).`,
      );
    }

    return (await res.json()) as RazorpayRefund;
  }

  // Razorpay signs webhook deliveries with a SEPARATE secret (configured alongside the webhook
  // URL in the Razorpay dashboard, not RAZORPAY_KEY_SECRET) as HMAC-SHA256 over the exact raw
  // request body — must be the untouched bytes Razorpay sent, not JSON.stringify(parsedBody),
  // which can reorder keys/whitespace and silently produce a different signature.
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const webhookSecret = this.config.getOrThrow<string>('RAZORPAY_WEBHOOK_SECRET');
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature);
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }
}
