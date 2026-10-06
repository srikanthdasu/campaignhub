import { api } from '@/lib/api';
import type { Campaign, MediaAsset } from '../types';

export function fetchMediaAssets(clientId: string) {
  return api.get<MediaAsset[]>(`/clients/${clientId}/media`);
}

export function fetchCampaigns(clientId: string) {
  return api.get<Campaign[]>(`/clients/${clientId}/campaigns`);
}

export function uploadMedia(clientId: string, form: FormData) {
  return api.upload<MediaAsset>(`/clients/${clientId}/media`, form);
}

export function deleteMedia(clientId: string, id: string) {
  return api.delete(`/clients/${clientId}/media/${id}`);
}

export function bulkDeleteMedia(clientId: string, ids: string[]) {
  return api.post(`/clients/${clientId}/media/bulk-delete`, { ids });
}

export function updateMedia(clientId: string, id: string, data: Record<string, unknown>) {
  return api.patch<MediaAsset>(`/clients/${clientId}/media/${id}`, data);
}
