import { api } from '@/lib/api';
import type { Overview } from '../types';

export function fetchAnalyticsOverview(clientId: string) {
  return api.get<Overview>(`/clients/${clientId}/analytics/overview`);
}
