import { api } from '@/lib/api';
import type { DemoLeadsResponse } from '../types';

export function fetchDemoLeads() {
  return api.get<DemoLeadsResponse>('/demo-leads');
}
