import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RazorpayService } from './razorpay.service.js';
import { SubscribeDto } from './dto/subscribe.dto.js';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto.js';
import { GST_RATE, PLANS } from './billing.constants.js';
import { SubscriptionStatus } from '../generated/prisma/client.js';

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
    const order = await this.razorpay.createOrder(amount, `${agencyId}-${Date.now()}`);
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
        paymentProviderRef: dto.paymentId,
      },
      update: {
        plan: dto.plan,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: dto.billingCycle,
        currentPeriodEnd,
        paymentProviderRef: dto.paymentId,
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
      metadata: { plan: dto.plan, billingCycle: dto.billingCycle, amount, razorpayPaymentId: dto.paymentId },
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
}
