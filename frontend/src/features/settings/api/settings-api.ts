import { api } from '@/lib/api';
import type { Agency } from '../types';

export function fetchAgency() {
  return api.get<Agency>('/agencies/me');
}

export function updateAgencySettings(payload: { name: string; settings: { timezone: string; brandColor: string } }) {
  return api.patch<Agency>('/agencies/me/settings', payload);
}
