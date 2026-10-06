import { api } from '@/lib/api';
import type { CampaignDetail, CampaignSummary, Member } from '../types';

export function fetchCampaigns(clientId: string) {
  return api.get<CampaignSummary[]>(`/clients/${clientId}/campaigns`);
}

export function fetchClientAccess(clientId: string) {
  return api.get<Member[]>(`/clients/${clientId}/access`);
}

export function fetchCampaignDetail(clientId: string, id: string) {
  return api.get<CampaignDetail>(`/clients/${clientId}/campaigns/${id}`);
}

export function createCampaign(clientId: string, payload: { name: string; objective: string | undefined }) {
  return api.post<CampaignSummary>(`/clients/${clientId}/campaigns`, payload);
}

export function updateCampaign(clientId: string, id: string, data: Record<string, unknown>) {
  return api.patch(`/clients/${clientId}/campaigns/${id}`, data);
}

export function deleteCampaign(clientId: string, id: string) {
  return api.delete(`/clients/${clientId}/campaigns/${id}`);
}
