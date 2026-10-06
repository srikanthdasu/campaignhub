import { api } from '@/lib/api';
import type { AdCampaign, PLATFORMS } from '../types';

export function fetchAds(clientId: string) {
  return api.get<AdCampaign[]>(`/clients/${clientId}/ads`);
}

export function fetchAdDetail(clientId: string, id: string) {
  return api.get<AdCampaign>(`/clients/${clientId}/ads/${id}`);
}

export function createAd(clientId: string, payload: { name: string; platform: (typeof PLATFORMS)[number] }) {
  return api.post<AdCampaign>(`/clients/${clientId}/ads`, payload);
}

export function updateAd(clientId: string, id: string, data: Record<string, unknown>) {
  return api.patch(`/clients/${clientId}/ads/${id}`, data);
}

export function submitForApproval(clientId: string, id: string) {
  return api.post(`/clients/${clientId}/ads/${id}/submit`);
}

export function reviewAd(clientId: string, id: string, payload: { status: 'APPROVED' | 'REJECTED' }) {
  return api.post(`/clients/${clientId}/ads/${id}/review`, payload);
}

export function launchAd(clientId: string, id: string) {
  return api.post(`/clients/${clientId}/ads/${id}/launch`);
}

export function deleteAd(clientId: string, id: string) {
  return api.delete(`/clients/${clientId}/ads/${id}`);
}
