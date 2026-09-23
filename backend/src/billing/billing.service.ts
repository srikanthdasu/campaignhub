import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RazorpayService } from './razorpay.service.js';
import { SubscribeDto } from './dto/subscribe.dto.js';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto.js';
import { GST_RATE, PLANS } from './billing.constants.js';
import { InvoiceStatus, Role, SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client.js';

// Invoice.amount/gstAmount are Prisma Decimal (see schema.prisma) so GST math never accumulates
// binary floating-point error — but a raw Decimal instance serializes to a *string* over JSON
// (its toJSON()), and the frontend does real arithmetic on these (`inv.amount + inv.gstAmount`),
// which would silently become string concatenation instead of addition. Converting back to a
// plain number at the API boundary keeps that contract exactly as it was before this migration.
// Number(...) works for both a real Decimal (its toString() feeds Number's ToNumber coercion)
// and the plain JS numbers billing.service.spec.ts's mocked PrismaService already returns.
function invoiceToPlainNumbers<T extends { amount: unknown; gstAmount: unknown }>(
  invoice: T,
): Omit<T, 'amount' | 'gstAmount'> & { amount: number; gstAmount: number } {
  return { ...invoice, amount: Number(invoice.amount), gstAmount: Number(invoice.gstAmount) };
}

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

// Prisma's unique-constraint-violation code (P2002) is stable across versions but not exported
// as a typed class from a convenient path in this generated client — duck-typing the well-known
// `code` field avoids reaching into generated internals for one check. No field-name match on
// `meta.target` needed: paymentProviderRef is the only unique constraint this specific
// invoice.create() call could ever hit (id is an auto-generated UUID).
function isUniqueConstraintViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';
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
    private notifications: NotificationsService,
  ) {}

  getPlans() {
    return PLANS;
  }

  // Billing events matter to whoever can act on them, not just whoever happened to click
  // "Subscribe" — an Owner/Admin who wasn't at the keyboard for a webhook-driven activation, a
  // cancellation, or a failed payment still needs to know.
  private async notifyAgencyAdmins(agencyId: string, message: string) {
    const admins = await this.prisma.user.findMany({
      where: { agencyId, role: { in: [Role.OWNER, Role.ADMIN] }, isActive: true },
      select: { id: true },
    });
    await this.notifications.createMany(admins.map((a) => a.id), message, '/billing');
  }

  getSubscription(agencyId: string) {
    return this.prisma.subscription.findUnique({ where: { agencyId } });
  }

  async listInvoices(agencyId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { agencyId },
      orderBy: { issuedAt: 'desc' },
    });
    return invoices.map(invoiceToPlainNumbers);
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
   *
   * The signature proves *that* orderId/paymentId are a real, matched pair — it proves nothing
   * about *what plan* that order was for. `dto.plan`/`dto.billingCycle` are client-supplied and
   * were previously trusted directly here, which let a signature valid for a cheap plan's order
   * be replayed with a different, more expensive plan substituted in the request body — the
   * signature still verified, since it never referenced plan/cycle at all. Fixed by re-fetching
   * the order from Razorpay and reading plan/billingCycle/gstNumber from its own `notes`, which
   * only this service ever wrote (at createCheckoutOrder, under the caller's own authenticated
   * session) — exactly the same trusted source processRazorpayWebhook below already used.
   */
  async confirmSubscription(agencyId: string, actorId: string, dto: ConfirmCheckoutDto) {
    const verified = this.razorpay.verifyPaymentSignature(dto.orderId, dto.paymentId, dto.signature);
    if (!verified) throw new BadRequestException('Payment verification failed');

    const order = await this.razorpay.fetchOrder(dto.orderId);
    const activation = this.parseActivationNotes(order.notes);
    if (!activation) {
      throw new BadRequestException('Could not verify what this order was for — please contact support.');
    }
    // The signature ties orderId to paymentId, but says nothing about which agency's order this
    // is — without this check, a leaked orderId+paymentId+signature triple from Agency A could be
    // replayed by Agency B (who has their own valid JWT session) to activate Agency B's plan on
    // Agency A's payment. Confirming the order's own notes.agencyId matches the caller closes that.
    if (activation.agencyId !== agencyId) {
      throw new BadRequestException('This order does not belong to your agency.');
    }

    return this.activateSubscription(agencyId, dto.paymentId, activation, actorId);
  }

  /**
   * Shared with processRazorpayWebhook below — both paths must derive plan/billingCycle/gstNumber
   * from Razorpay's own order notes (set once, server-side, at createCheckoutOrder), never from
   * anything a client sends back later. Returns null (never throws) so each caller can decide its
   * own failure behavior — the webhook logs and 200s to stop Razorpay retry-storming us for data
   * it can't fix, while confirmSubscription throws a real error back to the browser.
   */
  private parseActivationNotes(notes: Record<string, string> | undefined) {
    if (!notes?.agencyId || !notes.plan || !notes.billingCycle) return null;
    if (!Object.values(SubscriptionPlan).includes(notes.plan as SubscriptionPlan)) return null;
    return {
      agencyId: notes.agencyId,
      plan: notes.plan as SubscriptionPlan,
      billingCycle: notes.billingCycle as 'MONTHLY' | 'YEARLY',
      gstNumber: notes.gstNumber || undefined,
    };
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
      // Keep the same {subscription, invoice, alreadyProcessed} shape as the path below returns
      // — the invoice for this exact payment is the same one the original activation created.
      const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { paymentProviderRef: paymentId } });
      return { subscription: existing, invoice: invoiceToPlainNumbers(invoice), alreadyProcessed: true as const };
    }

    // activateSubscription's own alreadyProcessed (from the Invoice.paymentProviderRef unique
    // constraint) is the authoritative answer here — the check above is just a cheap fast path
    // that can miss an older payment once a newer one has overwritten Subscription's single
    // paymentProviderRef field; don't let this method's own default silently override it.
    return this.activateSubscription(agencyId, paymentId, dto, null);
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

    let invoice: Awaited<ReturnType<typeof this.prisma.invoice.create>>;
    try {
      invoice = await this.prisma.invoice.create({
        data: {
          agencyId,
          subscriptionId: subscription.id,
          amount,
          gstAmount,
          gstNumber: dto.gstNumber,
          status: 'PAID',
          paymentProviderRef: paymentId,
        },
      });
    } catch (err) {
      // Invoice.paymentProviderRef's unique constraint is the real idempotency key — this exact
      // payment was already invoiced, whether from a genuine replay (double-submit) or a race
      // between confirmSubscription and the webhook both activating the same payment at once.
      // Subscription.upsert above is safely repeatable either way; only the invoice write needs
      // this guard. Returning the existing invoice keeps a duplicate call a no-op instead of
      // surfacing a confusing error on what the user experiences as one successful checkout.
      if (isUniqueConstraintViolation(err)) {
        const existing = await this.prisma.invoice.findUniqueOrThrow({ where: { paymentProviderRef: paymentId } });
        return { subscription, invoice: invoiceToPlainNumbers(existing), alreadyProcessed: true as const };
      }
      throw err;
    }

    await this.audit.log({
      userId: actorId,
      action: 'SUBSCRIPTION_ACTIVATED',
      entityType: 'subscription',
      entityId: subscription.id,
      metadata: { plan: dto.plan, billingCycle: dto.billingCycle, amount, razorpayPaymentId: paymentId },
    });

    await this.notifyAgencyAdmins(agencyId, `Your ${dto.plan} subscription is now active.`);

    return { subscription, invoice: invoiceToPlainNumbers(invoice), alreadyProcessed: false as const };
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

    await this.notifyAgencyAdmins(agencyId, 'Your subscription was cancelled.');

    return subscription;
  }

  private async requireOwnInvoice(agencyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.agencyId !== agencyId) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  /**
   * A real refund — money actually moves back via Razorpay's refund API against the original
   * payment. Only a PAID invoice with a real paymentProviderRef can be refunded; anything else
   * (ISSUED, OVERDUE, or already REFUNDED/VOID) has either never been paid or has already been
   * resolved. Always a full refund of the invoice — no partial-amount support, since nothing in
   * this app currently has a reason to refund less than the whole thing.
   */
  async refundInvoice(agencyId: string, actorId: string, invoiceId: string) {
    const invoice = await this.requireOwnInvoice(agencyId, invoiceId);
    if (invoice.status !== InvoiceStatus.PAID) {
      throw new BadRequestException('Only a paid invoice can be refunded');
    }
    if (!invoice.paymentProviderRef) {
      throw new BadRequestException('This invoice has no associated payment to refund');
    }

    const refund = await this.razorpay.refundPayment(invoice.paymentProviderRef);

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.REFUNDED },
    });

    await this.audit.log({
      userId: actorId,
      action: 'INVOICE_REFUNDED',
      entityType: 'invoice',
      entityId: invoiceId,
      metadata: { razorpayRefundId: refund.id, amount: Number(invoice.amount) },
    });

    await this.notifyAgencyAdmins(agencyId, `Invoice for ₹${Number(invoice.amount).toFixed(2)} was refunded.`);

    return invoiceToPlainNumbers(updated);
  }

  /**
   * An accounting correction, not a refund — no money moves and no Razorpay call happens. For
   * marking an invoice as not-counting (e.g. a duplicate) without implying a payment was returned.
   * REFUNDED and VOID are each other's terminal states — once either, an invoice can't move again.
   */
  async voidInvoice(agencyId: string, actorId: string, invoiceId: string) {
    const invoice = await this.requireOwnInvoice(agencyId, invoiceId);
    if (invoice.status === InvoiceStatus.REFUNDED || invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('This invoice has already been resolved');
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.VOID },
    });

    await this.audit.log({
      userId: actorId,
      action: 'INVOICE_VOIDED',
      entityType: 'invoice',
      entityId: invoiceId,
    });

    return invoiceToPlainNumbers(updated);
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

    if (body.event === 'payment.failed') {
      const entity = body.payload?.payment?.entity;
      const activation = entity?.notes ? this.parseActivationNotes(entity.notes) : null;
      if (activation) {
        await this.notifyAgencyAdmins(
          activation.agencyId,
          `Your payment for the ${activation.plan} plan failed — please retry from the Billing page.`,
        );
      }
      return { received: true, handled: Boolean(activation) };
    }

    if (body.event !== 'payment.captured') {
      return { received: true, handled: false };
    }

    const entity = body.payload?.payment?.entity;
    if (!entity?.id) {
      this.logger.warn('payment.captured webhook missing a payment id');
      return { received: true, handled: false };
    }
    const activation = this.parseActivationNotes(entity.notes);
    if (!activation) {
      this.logger.warn(`payment.captured webhook had missing/unrecognized notes — payment ${entity.id}`);
      return { received: true, handled: false };
    }

    const result = await this.activateFromWebhook(activation.agencyId, entity.id, activation);

    return { received: true, handled: true, alreadyProcessed: result.alreadyProcessed };
  }
}
