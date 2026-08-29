import { SubscriptionPlan } from '../generated/prisma/client.js';

export const GST_RATE = 0.18;

export interface PlanDefinition {
  plan: SubscriptionPlan;
  name: string;
  priceMonthlyInr: number | null;
  priceYearlyInr: number | null;
  features: string[];
}

export const PLANS: PlanDefinition[] = [
  {
    plan: SubscriptionPlan.STARTER,
    name: 'Starter',
    priceMonthlyInr: 999,
    priceYearlyInr: 9990,
    features: ['Up to 3 users', '5 campaigns', 'Basic analytics', 'Email support'],
  },
  {
    plan: SubscriptionPlan.GROWTH,
    name: 'Growth',
    priceMonthlyInr: 2499,
    priceYearlyInr: 24990,
    features: ['Up to 15 users', 'Unlimited campaigns', 'Advanced analytics', 'Priority support'],
  },
  {
    plan: SubscriptionPlan.ENTERPRISE,
    name: 'Enterprise',
    priceMonthlyInr: null,
    priceYearlyInr: null,
    features: ['Custom users', 'Advanced security', 'Dedicated support', 'SLA & onboarding'],
  },
];
