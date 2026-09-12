import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RazorpayService } from './razorpay.service.js';
import { SubscribeDto } from './dto/subscribe.dto.js';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto.js';
import { GST_RATE, PLANS } from './billing.constants.js';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client.js';

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        notes?: Record<string, string>;
      };
    };
  };
}

function resolvePlanAmount(dto: { plan: string; billingCycle: 'MONTHLY' | 'YEARLY' }) {
  const planDef = PLANS.find((p) => p.plan === dto.plan);
  if (!planDef) throw new BadRequestException('Unknown plan');
  if (planDef.priceMonthlyInr === null) {
    throw new BadRequestException('Enterprise pricing is custom — contact sales instead of self-serve checkout');
  }
  return dto.billingCycle === 'YEARLY' ? planDef.priceYearlyInr! : planDef.priceMonthlyInr;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private razorpay: RazorpayService,
  ) {}

  getPlans() {
    return PLANS;
  }

  getSubscription(agencyId: string) {
    return this.prisma.subscription.findUnique({ where: { agencyId } });
  }

  listInvoices(agencyId: string) {
    return this.prisma.invoice.findMany({
      where: { agencyId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /** Step 1 of checkout: opens a real Razorpay order for the frontend to hand to Checkout.js. */
  async createCheckoutOrder(agencyId: string, dto: SubscribeDto) {
    const amount = resolvePlanAmount(dto);
    // Razorpay caps "receipt" at 56 characters — a UUID (36) + "-" + a 13-digit timestamp is 50,
    // safely under that without needing to truncate anything meaningful out of it.
    // notes carry plan/billingCycle/gstNumber onto the order (and Razorpay copies them onto the
    // resulting payment) so the webhook below can activate the right plan even if the browser
    // never calls back — see confirmFromWebhook.
    const order = await this.razorpay.createOrder(amount, `${agencyId}-${Date.now()}`, {
      agencyId,
      plan: dto.plan,
      billingCycle: dto.billingCycle,
      gstNumber: dto.gstNumber ?? '',
    });
    return { orderId: order.id, amount, currency: order.currency, keyId: this.razorpay.keyId };
  }

  /**
   * Step 2: activates the subscription and issues a GST invoice, but only after verifying the
   * payment signature Razorpay's callback returned — that's what proves a real (test-mode)
   * charge happened rather than the client just claiming success.
   */
  async confirmSubscription(agencyId: string, actorId: string, dto: ConfirmCheckoutDto) {
    const verified = this.razorpay.verifyPaymentSignature(dto.orderId, dto.paymentId, dto.signature);
    if (!verified) throw new BadRequestException('Payment verification failed');

    return this.activateSubscription(agencyId, dto.paymentId, dto, actorId);
  }

  /**
   * Server-to-server safety net for the same activation confirmSubscription does: if the
   * client's browser closes (or the request just fails to reach us) after Razorpay has already
   * captured payment, the subscription would otherwise never activate — nothing server-side was
   * watching for that outcome. Called from the signature-verified webhook controller route with
   * the plan/billingCycle/gstNumber recovered from the order's own notes (set at checkout), not
   * from anything the client supplied, so it activates correctly even with no client involved at
   * all. Idempotent against being called twice for the same payment (webhook retry, or both this
   * and confirmSubscription firing for one checkout).
   */
  async activateFromWebhook(
    agencyId: string,
    paymentId: string,
    dto: { plan: SubscribeDto['plan']; billingCycle: SubscribeDto['billingCycle']; gstNumber?: string },
  ) {
    const existing = await this.prisma.subscription.findUnique({ where: { agencyId } });
    if (existing?.paymentProviderRef === paymentId) {
      return { subscription: existing, alreadyProcessed: true as const };
    }

    const result = await this.activateSubscription(agencyId, paymentId, dto, null);
    return { ...result, alreadyProcessed: false as const };
  }

  private async activateSubscription(
    agencyId: string,
    paymentId: string,
    dto: { plan: SubscribeDto['plan']; billingCycle: SubscribeDto['billingCycle']; gstNumber?: string },
    actorId: string | null,
  ) {
    const amount = resolvePlanAmount(dto);
    const gstAmount = Math.round(amount * GST_RATE * 100) / 100;
    const periodDays = dto.billingCycle === 'YEARLY' ? 365 : 30;
    const currentPeriodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.subscription.upsert({
      where: { agencyId },
      create: {
        agencyId,
        plan: dto.plan,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: dto.billingCycle,
        currentPeriodEnd,
        paymentProviderRef: paymentId,
      },
      update: {
        plan: dto.plan,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: dto.billingCycle,
        currentPeriodEnd,
        paymentProviderRef: paymentId,
      },
    });

    const invoice = await this.prisma.invoice.create({
      data: {
        agencyId,
        subscriptionId: subscription.id,
        amount,
        gstAmount,
        gstNumber: dto.gstNumber,
        status: 'PAID',
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'SUBSCRIPTION_ACTIVATED',
      entityType: 'subscription',
      entityId: subscription.id,
      metadata: { plan: dto.plan, billingCycle: dto.billingCycle, amount, razorpayPaymentId: paymentId },
    });

    return { subscription, invoice };
  }

  async cancel(agencyId: string, actorId: string) {
    const subscription = await this.prisma.subscription.update({
      where: { agencyId },
      data: { status: SubscriptionStatus.CANCELLED },
    });

    await this.audit.log({
      userId: actorId,
      action: 'SUBSCRIPTION_CANCELLED',
      entityType: 'subscription',
      entityId: subscription.id,
    });

    return subscription;
  }

  /**
   * Verifies the signature against the exact raw bytes Razorpay sent (never the re-parsed
   * object — see razorpay.service.ts), then parses that same verified buffer for the event.
   * Only `payment.captured` triggers activation; every other event type is acknowledged (200)
   * without action so Razorpay doesn't retry-storm us for events we don't act on.
   */
  async processRazorpayWebhook(rawBody: Buffer, signature: string) {
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const body = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookPayload;
    if (body.event !== 'payment.captured') {
      return { received: true, handled: false };
    }

    const entity = body.payload?.payment?.entity;
    const notes = entity?.notes;
    if (!entity?.id || !notes?.agencyId || !notes.plan || !notes.billingCycle) {
      this.logger.warn(`payment.captured webhook missing expected notes — payment ${entity?.id ?? 'unknown'}`);
      return { received: true, handled: false };
    }
    if (!Object.values(SubscriptionPlan).includes(notes.plan as SubscriptionPlan)) {
      this.logger.warn(`payment.captured webhook had an unrecognized plan in notes: ${notes.plan}`);
      return { received: true, handled: false };
    }

    const result = await this.activateFromWebhook(notes.agencyId, entity.id, {
      plan: notes.plan as SubscriptionPlan,
      billingCycle: notes.billingCycle as 'MONTHLY' | 'YEARLY',
      gstNumber: notes.gstNumber || undefined,
    });

    return { received: true, handled: true, alreadyProcessed: result.alreadyProcessed };
  }
}
