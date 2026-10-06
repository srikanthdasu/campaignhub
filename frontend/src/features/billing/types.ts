declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open(): void };
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}

export type Plan = 'STARTER' | 'GROWTH' | 'ENTERPRISE';
export type SubStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'PAUSED';

export interface PlanDefinition {
  plan: Plan;
  name: string;
  priceMonthlyInr: number | null;
  priceYearlyInr: number | null;
  features: string[];
}

export interface Subscription {
  id: string;
  plan: Plan;
  status: SubStatus;
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodEnd: string | null;
}

export interface Invoice {
  id: string;
  amount: number;
  gstAmount: number;
  currency: string;
  status: string;
  issuedAt: string;
}

export const STATUS_TONE: Record<SubStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  TRIAL: 'accent',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  CANCELLED: 'danger',
  EXPIRED: 'danger',
  PAUSED: 'warning',
};

export const INVOICE_STATUS_TONE: Record<string, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  ISSUED: 'accent',
  PAID: 'success',
  OVERDUE: 'warning',
  REFUNDED: 'danger',
  VOID: 'neutral',
};

export const VIEW_ROLES = ['OWNER', 'ADMIN'];
