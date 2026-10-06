import { api } from '@/lib/api';
import type { AgencyRow } from '../types';

export function fetchAgencies() {
  return api.get<AgencyRow[]>('/users/agencies');
}
