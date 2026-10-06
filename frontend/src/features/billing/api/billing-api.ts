import { api } from '@/lib/api';
import type { Invoice, Plan, PlanDefinition, Subscription } from '../types';

export function fetchPlans() {
  return api.get<PlanDefinition[]>('/billing/plans');
}

export function fetchSubscription() {
  return api.get<Subscription | null>('/billing/subscription');
}

export function fetchInvoices() {
  return api.get<Invoice[]>('/billing/invoices');
}

export function createCheckout(payload: {
  plan: Plan;
  billingCycle: 'MONTHLY' | 'YEARLY';
  gstNumber: string | undefined;
}) {
  return api.post<{ orderId: string; amount: number; currency: string; keyId: string }>(
    '/billing/checkout',
    payload,
  );
}

export function verifyCheckout(payload: {
  plan: Plan;
  billingCycle: 'MONTHLY' | 'YEARLY';
  gstNumber: string | undefined;
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  return api.post('/billing/checkout/verify', payload);
}

export function cancelSubscription() {
  return api.post('/billing/cancel');
}

export function refundInvoice(id: string) {
  return api.post(`/billing/invoices/${id}/refund`);
}

export function voidInvoice(id: string) {
  return api.post(`/billing/invoices/${id}/void`);
}
