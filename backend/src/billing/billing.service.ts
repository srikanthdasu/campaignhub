import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SubscribeDto } from './dto/subscribe.dto.js';
import { GST_RATE, PLANS } from './billing.constants.js';
import { SubscriptionStatus } from '../generated/prisma/client.js';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
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

  /**
   * No Razorpay/Stripe credentials exist in this environment, so this marks the subscription
   * active and issues a GST invoice without calling a real payment gateway — the checkout step
   * is simulated, everything around it (plan record, invoice, GST math) is real.
   */
  async subscribe(agencyId: string, actorId: string, dto: SubscribeDto) {
    const planDef = PLANS.find((p) => p.plan === dto.plan);
    if (!planDef) throw new BadRequestException('Unknown plan');
    if (planDef.priceMonthlyInr === null) {
      throw new BadRequestException('Enterprise pricing is custom — contact sales instead of self-serve checkout');
    }

    const amount = dto.billingCycle === 'YEARLY' ? planDef.priceYearlyInr! : planDef.priceMonthlyInr;
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
      },
      update: {
        plan: dto.plan,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: dto.billingCycle,
        currentPeriodEnd,
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
      metadata: { plan: dto.plan, billingCycle: dto.billingCycle, amount, simulated: true },
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
