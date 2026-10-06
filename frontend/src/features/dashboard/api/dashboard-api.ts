import { api } from '@/lib/api';
import type { Agency, Overview, Subscription } from '../types';

export function fetchAgency() {
  return api.get<Agency>('/agencies/me');
}

export function fetchOverview() {
  return api.get<Overview>('/dashboard/overview');
}

export function fetchMembers() {
  return api.get<unknown[]>('/users');
}

export function fetchSubscription() {
  return api.get<Subscription | null>('/billing/subscription');
}
